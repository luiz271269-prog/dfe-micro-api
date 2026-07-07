import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Relatório de rastreio de PIX por funcionário × competência.
// Regras de negócio:
//  - Competência M é paga no 5º dia útil do mês M+1 (salário)
//  - Comissão é paga do dia 10 em diante do mês M+1
//  - PIX extras = adiantamentos/vales
// Fontes: FolhaPagamento + VinculoExtrato (classificação feita pelo conciliarFolhaExtrato) + LancamentoBancario.
// Também detecta PIX nominais SEM vínculo (não rastreados) por funcionário.

function normalizar(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function chavesNome(nome) {
  const partes = normalizar(nome).split(' ').filter(p => p.length >= 3);
  if (partes.length === 0) return [];
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  const chaves = new Set();
  if (partes.length >= 2) chaves.add(`${primeiro} ${ultimo}`);
  if (ultimo.length >= 5) chaves.add(ultimo);
  if (primeiro.length >= 5) chaves.add(primeiro);
  if (chaves.size === 0) chaves.add(primeiro);
  return [...chaves];
}

// 5º dia útil do mês seguinte à competência (YYYY-MM)
function quintoDiaUtil(competencia) {
  const [ano, mes] = competencia.split('-').map(Number);
  let d = new Date(Date.UTC(ano, mes, 1)); // dia 1 do mês M+1
  let uteis = 0;
  while (true) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      uteis++;
      if (uteis === 5) return d.toISOString().split('T')[0];
    }
    d = new Date(d.getTime() + 86400000);
  }
}

function classificarVinculo(v) {
  if (v.tipo_vinculo === 'adiantamento') return 'adiantamento';
  const obs = normalizar(v.observacao);
  if (obs.startsWith('comissao')) return 'comissao';
  if (obs.startsWith('salario integral')) return 'salario';
  if (obs.startsWith('salario base')) return 'salario';
  if (obs.startsWith('complemento')) return 'complemento';
  return 'salario';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;
    const [folhas, funcionarios, vinculos, lancamentos] = await Promise.all([
      svc.FolhaPagamento.list('-competencia', 1000),
      svc.Funcionario.list('nome', 500),
      svc.VinculoExtrato.filter({ entidade_tipo: 'FolhaPagamento' }, '-created_date', 5000),
      svc.LancamentoBancario.list('-data', 5000),
    ]);

    const lancById = new Map(lancamentos.map(l => [l.id, l]));
    const vinculosPorFolha = new Map();
    const lancIdsVinculados = new Set();
    for (const v of vinculos) {
      if (!vinculosPorFolha.has(v.entidade_id)) vinculosPorFolha.set(v.entidade_id, []);
      vinculosPorFolha.get(v.entidade_id).push(v);
      lancIdsVinculados.add(v.lancamento_bancario_id);
    }

    // Monta o relatório: funcionário → competências
    const porFuncionario = new Map();
    for (const folha of folhas) {
      const nome = folha.funcionario_nome;
      if (!porFuncionario.has(nome)) porFuncionario.set(nome, { competencias: [] });
      const vincs = vinculosPorFolha.get(folha.id) || [];

      const dataEsperada = quintoDiaUtil(folha.competencia);
      let pixSalario = 0, pixComissao = 0, pixAdiantamento = 0;
      let dataSalario = null;
      const pixDetalhe = [];

      for (const v of vincs) {
        const lanc = lancById.get(v.lancamento_bancario_id);
        const tipo = classificarVinculo(v);
        const valor = v.valor_alocado || 0;
        if (tipo === 'adiantamento') pixAdiantamento += valor;
        else if (tipo === 'comissao') pixComissao += valor;
        else {
          pixSalario += valor;
          if (!dataSalario || (lanc?.data && lanc.data < dataSalario)) dataSalario = lanc?.data || null;
        }
        pixDetalhe.push({
          data: lanc?.data || null,
          valor,
          tipo,
          descricao: lanc?.descricao || '(lançamento não encontrado)',
        });
      }

      const liquido = folha.salario_liquido || 0;
      const totalPago = pixSalario + pixComissao;
      const diferenca = Math.round((liquido - totalPago) * 100) / 100;

      // Verifica pontualidade do salário vs 5º dia útil (tolerância 2 dias úteis ≈ 4 corridos)
      let pontualidade = null;
      if (dataSalario && folha.tipo !== 'ferias') {
        const diffDias = Math.round((new Date(dataSalario).getTime() - new Date(dataEsperada).getTime()) / 86400000);
        pontualidade = { data_esperada: dataEsperada, data_real: dataSalario, dias_diferenca: diffDias, no_prazo: Math.abs(diffDias) <= 4 };
      }

      porFuncionario.get(nome).competencias.push({
        competencia: folha.competencia,
        tipo: folha.tipo || 'mensal',
        status: folha.status,
        liquido,
        pix_salario: Math.round(pixSalario * 100) / 100,
        pix_comissao: Math.round(pixComissao * 100) / 100,
        pix_adiantamentos: Math.round(pixAdiantamento * 100) / 100,
        total_pago: Math.round(totalPago * 100) / 100,
        diferenca,
        pontualidade,
        pix: pixDetalhe.sort((a, b) => (a.data || '').localeCompare(b.data || '')),
      });
    }

    // PIX nominais NÃO rastreados (saída com nome do funcionário mas sem vínculo)
    const saidasLivres = lancamentos.filter(l => l.valor < 0 && !lancIdsVinculados.has(l.id));
    const naoRastreados = [];
    for (const func of funcionarios.filter(f => f.status !== 'desligado')) {
      const chaves = chavesNome(func.nome);
      if (chaves.length === 0) continue;
      const achados = saidasLivres.filter(l => {
        const desc = normalizar(l.descricao);
        return chaves.some(k => desc.includes(k));
      });
      for (const l of achados) {
        naoRastreados.push({
          funcionario: func.nome,
          data: l.data,
          valor: Math.abs(l.valor),
          descricao: l.descricao,
          lancamento_id: l.id,
        });
      }
    }

    // Serializa ordenado
    const relatorio = [...porFuncionario.entries()]
      .map(([nome, dados]) => {
        const comps = dados.competencias.sort((a, b) => b.competencia.localeCompare(a.competencia));
        return {
          funcionario: nome,
          total_liquido: Math.round(comps.reduce((s, c) => s + c.liquido, 0) * 100) / 100,
          total_pago: Math.round(comps.reduce((s, c) => s + c.total_pago, 0) * 100) / 100,
          total_adiantamentos: Math.round(comps.reduce((s, c) => s + c.pix_adiantamentos, 0) * 100) / 100,
          competencias: comps,
        };
      })
      .sort((a, b) => a.funcionario.localeCompare(b.funcionario));

    return Response.json({
      success: true,
      gerado_em: new Date().toISOString(),
      funcionarios: relatorio,
      pix_nao_rastreados: naoRastreados.sort((a, b) => (b.data || '').localeCompare(a.data || '')),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});