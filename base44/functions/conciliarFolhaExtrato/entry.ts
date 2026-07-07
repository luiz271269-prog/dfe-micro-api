import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Concilia FolhaPagamento pendente com PIX do extrato bancário.
// Regras de negócio (NeuralTec):
//  - Salário: pago no 5º dia útil do mês seguinte à competência
//  - Comissão: um ou mais PIX do dia 10 em diante (vendedores: Tiago e Thaís)
//  - PIX extras dentro do mês da competência = adiantamento (vale)
//
// Estratégia v2 (anti falso-positivo):
//  1. Extrai o NOME COMPLETO do beneficiário da descrição do PIX
//     (padrão: "PAGAMENTO PIX <CPF> <NOME COMPLETO>").
//  2. Cada PIX é atribuído globalmente à MELHOR pessoa (score de tokens do nome).
//     "Thiago"≈"Tiago" e "Thais"≈"Tais" via normalização th→t.
//     "Luiz Carlos Liesch" vence "Luiz Gabriel Liesch" para o PIX certo (3 vs 2 tokens).
//  3. Cada PIX entra em NO MÁXIMO UMA folha (set global de usados) —
//     alocação cronológica: folha pendente mais antiga primeiro, dentro da janela.

function normalizarTexto(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// tokens fonéticos: th→t (thiago=tiago, thais=tais)
function tokensNome(nome) {
  return normalizarTexto(nome)
    .split(' ')
    .filter(t => t.length >= 3 && !/^\d+$/.test(t))
    .map(t => t.replace(/^th/, 't'));
}

// Extrai o nome do beneficiário da descrição do PIX
function beneficiarioDesc(descricao) {
  const norm = normalizarTexto(descricao);
  // remove prefixos comuns e números (CPF/CNPJ)
  return norm.replace(/pagamento|transferencia|pix|enviado|debito/g, ' ').replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Score de match entre beneficiário do PIX e o nome da pessoa
function scoreMatch(tokensBenef, tokensPessoa) {
  if (tokensPessoa.length === 0 || tokensBenef.length === 0) return 0;
  const setBenef = new Set(tokensBenef);
  const matches = tokensPessoa.filter(t => setBenef.has(t)).length;
  if (matches === 0) return 0;
  // exige pelo menos 2 tokens em comum, OU nome de 1 token com match forte (≥5 letras)
  if (matches < 2 && !(tokensPessoa.length === 1 && tokensPessoa[0].length >= 5)) return 0;
  return matches * 10 + (matches / tokensPessoa.length); // mais tokens > proporção
}

function competenciaParaJanela(competencia, tipo) {
  const [ano, mes] = competencia.split('-').map(Number);
  if (tipo === 'ferias') {
    // Férias pagas até 2 dias antes do início — janela: mês anterior até fim do mês da competência
    return {
      inicio: new Date(Date.UTC(ano, mes - 2, 1)).toISOString().split('T')[0],
      fim: new Date(Date.UTC(ano, mes, 0)).toISOString().split('T')[0],
    };
  }
  // Mensal: do dia 15 da competência (vales) até o último dia do mês seguinte (salário 5º dia útil + comissões dia 10+)
  return {
    inicio: new Date(Date.UTC(ano, mes - 1, 15)).toISOString().split('T')[0],
    fim: new Date(Date.UTC(ano, mes + 1, 0)).toISOString().split('T')[0],
  };
}

// Classifica um PIX no contexto da folha
function classificarPix(pixValor, pixData, folha, totalAlocadoAntes) {
  const liquido = folha.salario_liquido || 0;
  const comissao = folha.comissao || 0;
  const descontos = (folha.desconto_inss || 0) + (folha.desconto_irrf || 0)
                  + (folha.desconto_vt || 0) + (folha.desconto_vr || 0)
                  + (folha.outros_descontos || 0);
  const baseSemComissao = (folha.salario_bruto || 0) - descontos;
  const TOL = 50;
  const restante = liquido - totalAlocadoAntes;
  // PIX dentro do próprio mês da competência = adiantamento (vale)
  const dentroDaCompetencia = pixData.slice(0, 7) === folha.competencia;

  if (restante <= TOL) return 'adiantamento';
  if (Math.abs(pixValor - liquido) <= TOL) return dentroDaCompetencia ? 'adiantamento' : 'salario_integral';
  if (Math.abs(pixValor - baseSemComissao) <= TOL && !dentroDaCompetencia) return 'salario_base';
  if (comissao > 0 && Math.abs(pixValor - comissao) <= TOL && !dentroDaCompetencia) return 'comissao';
  if (dentroDaCompetencia) return 'adiantamento';
  if (pixValor <= restante + TOL) return 'complemento';
  return 'adiantamento';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internoOk = !!body?.internal_token && body.internal_token === Deno.env.get('NEXUS_HUB_TOKEN');
    if (!internoOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const svc = base44.asServiceRole.entities;

    const [folhasPendentes, funcionarios, lancamentos, vinculosExistentes] = await Promise.all([
      svc.FolhaPagamento.filter({ status: 'pendente' }),
      svc.Funcionario.list('', 200),
      svc.LancamentoBancario.list('-data', 5000),
      svc.VinculoExtrato.list('-created_date', 5000),
    ]);

    // PIX já usados em QUALQUER vínculo de folha — um PIX nunca entra em duas folhas
    const pixUsados = new Set(
      vinculosExistentes.filter(v => v.entidade_tipo === 'FolhaPagamento').map(v => v.lancamento_bancario_id)
    );

    const TOL_TOTAL = 50.00;
    const saidas = lancamentos.filter(l => l.valor < 0 && l.data);

    // ---- 1. Monta pessoas (nome de folha → nome mais completo conhecido) ----
    const pessoas = new Map(); // chave = nome da folha; valor = { tokens, folhas: [] }
    for (const folha of folhasPendentes) {
      const nomeFolha = folha.funcionario_nome;
      if (!pessoas.has(nomeFolha)) {
        const nfNorm = normalizarTexto(nomeFolha);
        // nome mais completo do cadastro, se bater
        const func = funcionarios.find(f => {
          const n = normalizarTexto(f.nome);
          return n === nfNorm || n.includes(nfNorm) || nfNorm.includes(n);
        });
        const nomeCompleto = (func && func.nome.length > nomeFolha.length) ? func.nome : nomeFolha;
        pessoas.set(nomeFolha, { tokens: tokensNome(nomeCompleto), folhas: [] });
      }
      pessoas.get(nomeFolha).folhas.push(folha);
    }

    // ---- 2. Atribui cada PIX à melhor pessoa (score global) ----
    const donoDoPix = new Map(); // lanc.id → chave da pessoa
    for (const lanc of saidas) {
      if (pixUsados.has(lanc.id)) continue;
      const tokensBenef = tokensNome(beneficiarioDesc(lanc.descricao));
      let melhor = null, melhorScore = 0;
      for (const [chave, pessoa] of pessoas) {
        const s = scoreMatch(tokensBenef, pessoa.tokens);
        if (s > melhorScore) { melhorScore = s; melhor = chave; }
      }
      if (melhor) donoDoPix.set(lanc.id, melhor);
    }

    // ---- 3. Aloca PIX por pessoa, folha mais antiga primeiro ----
    let conciliadas = 0, parciais = 0, adiantamentos = 0, semMatch = 0;
    const detalhes = [];

    for (const [chave, pessoa] of pessoas) {
      const folhasOrdenadas = pessoa.folhas.sort((a, b) =>
        (a.competencia || '').localeCompare(b.competencia || ''));

      // PASSO A — reserva PIX cujo valor bate EXATO com o líquido de uma folha
      // (evita que a folha anterior "roube" o pagamento integral da seguinte)
      const reservadoPara = new Map(); // lanc.id → folha.id
      for (const folha of folhasOrdenadas) {
        const { inicio, fim } = competenciaParaJanela(folha.competencia, folha.tipo);
        const liquido = folha.salario_liquido || 0;
        const candidato = saidas.find(l => !pixUsados.has(l.id)
          && !reservadoPara.has(l.id)
          && donoDoPix.get(l.id) === chave
          && l.data >= inicio && l.data <= fim
          && Math.abs(Math.abs(l.valor) - liquido) <= TOL_TOTAL
          && l.data.slice(0, 7) !== folha.competencia);
        if (candidato) reservadoPara.set(candidato.id, folha.id);
      }

      for (const folha of folhasOrdenadas) {
        const { inicio, fim } = competenciaParaJanela(folha.competencia, folha.tipo);
        const pixDaFolha = saidas
          .filter(l => !pixUsados.has(l.id)
            && donoDoPix.get(l.id) === chave
            && l.data >= inicio && l.data <= fim
            && (!reservadoPara.has(l.id) || reservadoPara.get(l.id) === folha.id))
          .sort((a, b) => a.data.localeCompare(b.data));

        if (pixDaFolha.length === 0) { semMatch++; continue; }

        const liquido = folha.salario_liquido || 0;
        let totalAlocado = 0;
        const classificados = [];
        for (const pix of pixDaFolha) {
          const valor = Math.abs(pix.valor);
          const tipo = classificarPix(valor, pix.data, folha, totalAlocado);
          classificados.push({ pix, valor, tipo });
          if (tipo !== 'adiantamento') totalAlocado += valor;
        }

        const diff = liquido - totalAlocado;
        let novoStatus, tipoVinculo;
        if (Math.abs(diff) <= TOL_TOTAL) {
          novoStatus = 'pago'; tipoVinculo = 'pagamento_integral'; conciliadas++;
        } else if (totalAlocado > 0) {
          novoStatus = 'pendente'; tipoVinculo = 'pagamento_parcial'; parciais++;
        } else {
          // só adiantamentos — registra os vales, folha continua pendente
          novoStatus = 'pendente'; tipoVinculo = 'pagamento_parcial';
        }

        const pixPrincipal = classificados.find(p => p.tipo !== 'adiantamento');
        if (novoStatus === 'pago') {
          await svc.FolhaPagamento.update(folha.id, {
            status: 'pago',
            data_pagamento: pixPrincipal?.pix.data,
            lancamento_bancario_id: pixPrincipal?.pix?.id || null,
          });
        }

        for (const { pix, valor, tipo } of classificados) {
          pixUsados.add(pix.id); // consome o PIX — nunca reutilizado em outra folha
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
          pix: classificados.map(p => ({ data: p.pix.data, valor: p.valor, tipo: p.tipo, descricao: p.pix.descricao })),
        });
      }
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