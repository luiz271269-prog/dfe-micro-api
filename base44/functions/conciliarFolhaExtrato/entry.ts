import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Concilia FolhaPagamento pendente com PIX/transferências do extrato bancário.
// Regra de negócio (NeuralTec):
//  - Folha (salário) é paga no 5º dia útil
//  - Comissão é paga do dia 10 em diante
//  - PIX adicionais no mês = adiantamento de salário
//
// Estratégia: para cada folha pendente, SOMAR todos os PIX do funcionário na janela
// (do dia 20 do mês de competência até dia 20 do mês seguinte). Classificar cada PIX:
//   - Salário (1º PIX, mais próximo do salário_bruto - descontos sem comissão)
//   - Comissão (PIX que ~= valor da comissão)
//   - Adiantamento (PIX extra além dos esperados)
// Status final:
//   - pago: soma PIX ≈ salário líquido (tolerância R$ 50)
//   - parcial: soma PIX < salário líquido (faltou comissão ou parcela)

function normalizarTexto(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chavesNome(nomeCompleto) {
  const partes = normalizarTexto(nomeCompleto).split(' ').filter(p => p.length >= 3);
  if (partes.length === 0) return [];
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  const chaves = new Set([primeiro]);
  if (ultimo !== primeiro) chaves.add(ultimo);
  if (partes.length >= 2) chaves.add(`${primeiro} ${ultimo}`);
  return [...chaves];
}

function competenciaParaJanela(competencia) {
  // Janela ampla: do dia 15 do mês de competência até o último dia do mês seguinte.
  // Cobre: adiantamento (fim do mês de competência) + salário (5º dia útil do mês seguinte)
  // + comissão (dia 10+ do mês seguinte) + atrasos até fim do mês seguinte.
  // Ex: competência abr → janela 15/abr → 31/mai.
  const [ano, mes] = competencia.split('-').map(Number);
  const inicio = new Date(ano, mes - 1, 15);
  const fim = new Date(ano, mes + 1, 0); // dia 0 do mês+2 = último dia do mês+1
  return { inicio: inicio.toISOString().split('T')[0], fim: fim.toISOString().split('T')[0] };
}

// Classifica um PIX dentro do contexto do que já foi alocado para a folha
function classificarPix(pixValor, folha, totalAlocadoAntes) {
  const liquido = folha.salario_liquido || 0;
  const comissao = folha.comissao || 0;
  const descontos = (folha.desconto_inss || 0) + (folha.desconto_irrf || 0)
                  + (folha.desconto_vt || 0) + (folha.desconto_vr || 0)
                  + (folha.outros_descontos || 0);
  const baseSemComissao = (folha.salario_bruto || 0) - descontos;
  const TOL = 50;
  const restante = liquido - totalAlocadoAntes; // quanto ainda falta pagar

  // Se já cobriu o líquido total, qualquer PIX adicional é adiantamento
  if (restante <= TOL) return 'adiantamento';
  // PIX = líquido inteiro → salário integral
  if (Math.abs(pixValor - liquido) <= TOL) return 'salario_integral';
  // PIX = salário base sem comissão
  if (Math.abs(pixValor - baseSemComissao) <= TOL) return 'salario_base';
  // PIX = valor da comissão
  if (comissao > 0 && Math.abs(pixValor - comissao) <= TOL) return 'comissao';
  // PIX cabe dentro do restante → considera complemento (será absorvido pela folha)
  if (pixValor <= restante + TOL) return 'complemento';
  // PIX maior que o restante → parte vai pra folha, parte sobra (adiantamento) — mas por simplicidade marca como adiantamento
  return 'adiantamento';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;

    const [folhasPendentes, funcionarios, lancamentos] = await Promise.all([
      svc.FolhaPagamento.filter({ status: 'pendente' }),
      svc.Funcionario.filter({ status: 'ativo' }),
      svc.LancamentoBancario.list('-data', 5000),
    ]);

    const TOL_TOTAL = 50.00;

    const saidas = lancamentos.filter(l => l.valor < 0);

    let conciliadas = 0;
    let parciais = 0;
    let adiantamentos = 0;
    let semMatch = 0;
    const detalhes = [];

    for (const folha of folhasPendentes) {
      // Tenta cruzar com Funcionario cadastrado para obter nome completo (melhora match no extrato).
      // Match flexível: nome exato OU funcionario_nome contido no cadastro OU primeiro nome em comum.
      const nomeFolhaNorm = normalizarTexto(folha.funcionario_nome);
      const func = funcionarios.find(f => {
        const nomeCadNorm = normalizarTexto(f.nome);
        if (nomeCadNorm === nomeFolhaNorm) return true;
        if (nomeCadNorm.includes(nomeFolhaNorm) || nomeFolhaNorm.includes(nomeCadNorm)) return true;
        return false;
      });

      // Usa nome completo do cadastro (mais palavras → match melhor); senão usa o da folha mesmo
      const nomeParaBusca = func?.nome || folha.funcionario_nome;
      const chaves = chavesNome(nomeParaBusca);
      if (chaves.length === 0) { semMatch++; continue; }

      const { inicio, fim } = competenciaParaJanela(folha.competencia);

      // Encontra TODOS os PIX do funcionário na janela. Filtro mais restrito:
      // exige match de pelo menos uma chave de 2 palavras OU sobrenome (≥4 letras) para evitar falso positivo com nome comum (ex: "Luiz" pegando fatura Magalu).
      const chavesRestrita = chaves.filter(k => k.includes(' ') || k.length >= 5);
      const chavesFinal = chavesRestrita.length > 0 ? chavesRestrita : chaves;
      const pixDoFunc = saidas
        .filter(l => {
          if (!l.data || l.data < inicio || l.data > fim) return false;
          const desc = normalizarTexto(l.descricao);
          return chavesFinal.some(k => desc.includes(k));
        })
        .sort((a, b) => (a.data || '').localeCompare(b.data || ''));

      if (pixDoFunc.length === 0) { semMatch++; continue; }

      // Classifica cada PIX e soma
      const liquido = folha.salario_liquido || 0;
      let totalAlocado = 0;
      const pixClassificados = [];

      for (const pix of pixDoFunc) {
        const valor = Math.abs(pix.valor);
        const tipo = classificarPix(valor, folha, totalAlocado);
        pixClassificados.push({ pix, valor, tipo });
        // Acumula tudo que não é adiantamento puro
        if (tipo !== 'adiantamento') totalAlocado += valor;
      }

      // Decide status final da folha
      const diff = liquido - totalAlocado;
      let novoStatus, tipoVinculo;
      if (Math.abs(diff) <= TOL_TOTAL) {
        novoStatus = 'pago';
        tipoVinculo = 'pagamento_integral';
        conciliadas++;
      } else if (totalAlocado > 0 && totalAlocado < liquido) {
        novoStatus = 'pendente'; // mantém pendente mas marca como parcial via data_pagamento do 1º
        tipoVinculo = 'pagamento_parcial';
        parciais++;
      } else {
        novoStatus = 'pendente';
        tipoVinculo = 'pagamento_parcial';
        semMatch++;
        continue;
      }

      // Atualiza folha
      const primeiraData = pixClassificados.find(p => p.tipo !== 'adiantamento')?.pix.data;
      if (novoStatus === 'pago') {
        await svc.FolhaPagamento.update(folha.id, {
          status: 'pago',
          data_pagamento: primeiraData,
        });
      }

      // Cria vínculos individuais (1 por PIX) — adiantamento é registrado mas com flag
      for (const { pix, valor, tipo } of pixClassificados) {
        try {
          await svc.VinculoExtrato.create({
            lancamento_bancario_id: pix.id,
            entidade_tipo: 'FolhaPagamento',
            entidade_id: folha.id,
            valor_alocado: valor,
            tipo_vinculo: tipo === 'adiantamento' ? 'adiantamento' : tipoVinculo,
            conciliado_por: 'auto',
            confianca: tipo === 'adiantamento' ? 70 : 90,
            observacao: `${tipo === 'salario_base' ? 'Salário base' :
                          tipo === 'comissao' ? 'Comissão' :
                          tipo === 'complemento' ? 'Complemento' :
                          tipo === 'salario_integral' ? 'Salário integral' :
                          'Adiantamento'} · ${folha.funcionario_nome} · ${folha.competencia}`,
          });
          if (tipo === 'adiantamento') adiantamentos++;
        } catch { /* silencioso */ }

        try {
          await svc.LancamentoBancario.update(pix.id, {
            status_conciliacao: tipo === 'adiantamento' ? 'parcial' : 'conciliado',
          });
        } catch { /* silencioso */ }
      }

      detalhes.push({
        funcionario: folha.funcionario_nome,
        competencia: folha.competencia,
        valor_folha: liquido,
        total_pix: Math.round(totalAlocado * 100) / 100,
        diferenca: Math.round(diff * 100) / 100,
        status: novoStatus === 'pago' ? 'pago' : 'parcial',
        pix: pixClassificados.map(p => ({
          data: p.pix.data,
          valor: p.valor,
          tipo: p.tipo,
          descricao: p.pix.descricao,
        })),
      });
    }

    return Response.json({
      success: true,
      conciliadas,
      parciais,
      adiantamentos_detectados: adiantamentos,
      sem_match: semMatch,
      total_pendentes: folhasPendentes.length,
      detalhes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});