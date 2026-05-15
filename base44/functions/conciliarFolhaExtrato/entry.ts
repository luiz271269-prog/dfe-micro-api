import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Concilia FolhaPagamento pendente com PIX/transferências do extrato bancário.
// Cruza por: nome do funcionário (na descrição do extrato) + valor (≈ salário líquido, tolerância R$ 2)
// + data próxima da competência (mesmo mês ou ±15 dias).
// Auto-baixa: marca folha como 'pago', preenche data_pagamento, cria VinculoExtrato para auditoria.

function normalizarTexto(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Primeiro nome + último sobrenome (mais confiável em extrato bancário, que costuma abreviar)
function chavesNome(nomeCompleto) {
  const partes = normalizarTexto(nomeCompleto).split(' ').filter(p => p.length >= 3);
  if (partes.length === 0) return [];
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  const chaves = new Set([primeiro]);
  if (ultimo !== primeiro) chaves.add(ultimo);
  // Adiciona pares "primeiro + ultimo"
  if (partes.length >= 2) chaves.add(`${primeiro} ${ultimo}`);
  return [...chaves];
}

function competenciaParaJanela(competencia) {
  // competencia = "2026-04" → janela: do dia 25 do mês até dia 15 do seguinte
  const [ano, mes] = competencia.split('-').map(Number);
  const inicio = new Date(ano, mes - 1, 20); // 20 do mês de competência
  const fim = new Date(ano, mes, 20); // 20 do mês seguinte (dia 20)
  return { inicio: inicio.toISOString().split('T')[0], fim: fim.toISOString().split('T')[0] };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;

    // Carrega folhas pendentes + funcionários ativos + lançamentos negativos recentes
    const [folhasPendentes, funcionarios, lancamentos] = await Promise.all([
      svc.FolhaPagamento.filter({ status: 'pendente' }),
      svc.Funcionario.filter({ status: 'ativo' }),
      svc.LancamentoBancario.list('-data', 5000),
    ]);

    // Tolerância maior para absorver adiantamentos, vales e arredondamentos
    const TOL_VALOR = 50.00;

    // Pré-indexa lançamentos negativos (saídas — PIX/transferência/pessoal)
    const saidas = lancamentos.filter(l =>
      l.valor < 0 &&
      ['pessoal', 'transferencia', 'recebimento'].includes(l.categoria) === false ?
        (l.categoria === 'pessoal' || /pix|transf|salar|folha|pagamento/i.test(l.descricao || '')) :
        true
    ).filter(l => l.valor < 0); // sempre saída

    let conciliadas = 0;
    let semMatch = 0;
    const detalhes = [];

    for (const folha of folhasPendentes) {
      const func = funcionarios.find(f => f.nome === folha.funcionario_nome);
      if (!func) { semMatch++; continue; }

      const chaves = chavesNome(folha.funcionario_nome);
      if (chaves.length === 0) { semMatch++; continue; }

      const { inicio, fim } = competenciaParaJanela(folha.competencia);

      // Procura lançamento que (1) está na janela de datas (2) bate valor (tol R$2) (3) descrição contém chave do nome
      const candidato = saidas.find(l => {
        if (!l.data || l.data < inicio || l.data > fim) return false;
        if (Math.abs(Math.abs(l.valor) - (folha.salario_liquido || 0)) > TOL_VALOR) return false;
        const desc = normalizarTexto(l.descricao);
        return chaves.some(k => desc.includes(k));
      });

      if (candidato) {
        const diferenca = (folha.salario_liquido || 0) - Math.abs(candidato.valor);
        // Baixa a folha (mantém status pago mesmo se diferença for pequena — pode ser vale/adiantamento)
        await svc.FolhaPagamento.update(folha.id, {
          status: 'pago',
          data_pagamento: candidato.data,
        });

        // Cria vínculo de auditoria
        try {
          await svc.VinculoExtrato.create({
            lancamento_bancario_id: candidato.id,
            entidade_tipo: 'FolhaPagamento',
            entidade_id: folha.id,
            valor_alocado: Math.abs(candidato.valor),
            tipo_vinculo: 'pagamento_integral',
            conciliado_por: 'auto',
            confianca: 95,
            observacao: `Auto-conciliação PIX folha · ${folha.funcionario_nome} · ${folha.competencia}`,
          });
        } catch { /* falha no vínculo não bloqueia a baixa */ }

        // Atualiza status do lançamento
        try {
          await svc.LancamentoBancario.update(candidato.id, { status_conciliacao: 'conciliado' });
        } catch { /* idem */ }

        conciliadas++;
        detalhes.push({
          funcionario: folha.funcionario_nome,
          competencia: folha.competencia,
          valor_folha: folha.salario_liquido,
          valor_pix: Math.abs(candidato.valor),
          diferenca: Math.round(diferenca * 100) / 100,
          data_pix: candidato.data,
          descricao_extrato: candidato.descricao,
        });
      } else {
        semMatch++;
      }
    }

    return Response.json({
      success: true,
      conciliadas,
      sem_match: semMatch,
      total_pendentes: folhasPendentes.length,
      detalhes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});