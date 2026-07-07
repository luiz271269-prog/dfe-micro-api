import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Concilia Compras (ItemCompra) ↔ Cartões de Crédito e Extrato Bancário.
// REGRAS (conservadoras, para evitar falso positivo):
//   AUTO: fornecedor ~ estabelecimento/descrição E valor bate (±R$0,50) E data na janela (emissão até +40 dias)
//   SUGESTÃO: valor bate na janela mas sem similaridade de nome (usuário confirma)
//   Compras da mesma nota podem ser agrupadas: soma dos itens da nota vs um único pagamento.

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function nomesSimilares(a, b) {
  const na = norm(a); const nb = norm(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const stop = new Set(['ltda', 'eireli', 'comercio', 'distribuicao', 'informatica', 'tecnologia', 'brasil']);
  const pa = na.split(/\s+/).filter(p => p.length >= 4 && !stop.has(p));
  const pb = nb.split(/\s+/).filter(p => p.length >= 4 && !stop.has(p));
  return pa.some(x => pb.some(y => x === y || x.includes(y) || y.includes(x)));
}

function diffDias(a, b) {
  return (new Date(b) - new Date(a)) / 86400000;
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
    const [compras, lancCartao, lancBanc, vincs, sugestoes] = await Promise.all([
      svc.ItemCompra.list('-data_emissao', 3000),
      svc.LancamentoCartao.list('-data_lancamento', 5000),
      svc.LancamentoBancario.list('-data', 5000),
      svc.VinculoExtrato.list('-created_date', 5000),
      svc.SugestaoConciliacao.filter({ status: 'pendente' }),
    ]);

    const comprasAbertas = compras.filter(c =>
      c.status_pagamento !== 'pago' && !c.lancamento_bancario_id && !c.lancamento_cartao_id
    );

    // Agrupa por nota (fornecedor + numero_nota) — pagamento geralmente é da nota inteira
    const grupos = new Map();
    for (const c of comprasAbertas) {
      const chave = `${norm(c.fornecedor)}|${c.numero_nota || c.id}`;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(c);
    }

    const cartaoUsado = new Set([
      ...compras.filter(c => c.lancamento_cartao_id).map(c => c.lancamento_cartao_id),
    ]);
    const bancoUsado = new Set(vincs.map(v => v.lancamento_bancario_id));
    const sugestaoExistente = new Set(sugestoes.filter(s => s.entidade_tipo === 'ItemCompra').map(s => s.entidade_id));

    const TOL = 0.50;
    const JANELA = 40; // dias após emissão (cobre boleto 28/35 dias)

    let autoCartao = 0, autoBanco = 0, sugestoesCriadas = 0;
    const detalhes = [];

    for (const [, itens] of grupos) {
      if (itens.some(i => sugestaoExistente.has(i.id))) continue;
      const fornecedor = itens[0].fornecedor;
      const dataEmissao = itens[0].data_emissao;
      const valorNota = itens.reduce((s, i) => s + (i.valor_total || 0), 0);
      if (valorNota < 0.01 || !dataEmissao) continue;

      // 1) CARTÃO — estabelecimento similar + valor da nota + janela
      const matchCartao = lancCartao.find(l => {
        if (cartaoUsado.has(l.id)) return false;
        if (Math.abs(Math.abs(l.valor) - valorNota) > TOL) return false;
        const d = diffDias(dataEmissao, l.data_lancamento);
        if (d < -2 || d > JANELA) return false;
        return nomesSimilares(fornecedor, l.estabelecimento);
      });

      if (matchCartao) {
        for (const i of itens) {
          await svc.ItemCompra.update(i.id, {
            status_pagamento: 'pago', forma_pagamento: 'cartao',
            lancamento_cartao_id: matchCartao.id, valor_pago: i.valor_total || 0,
          });
        }
        cartaoUsado.add(matchCartao.id);
        autoCartao++;
        detalhes.push({ via: 'cartao', fornecedor, nota: itens[0].numero_nota, valor: valorNota });
        continue;
      }

      // 2) EXTRATO — descrição contém fornecedor + valor da nota + janela
      const matchBanco = lancBanc.find(l => {
        if (l.valor >= 0 || bancoUsado.has(l.id)) return false;
        if (l.categoria === 'transferencia' || l.categoria === 'interno' || l.categoria === 'pro_labore') return false;
        if (Math.abs(Math.abs(l.valor) - valorNota) > TOL) return false;
        const d = diffDias(dataEmissao, l.data);
        if (d < -2 || d > JANELA) return false;
        return nomesSimilares(fornecedor, l.descricao);
      });

      if (matchBanco) {
        for (const i of itens) {
          await svc.ItemCompra.update(i.id, {
            status_pagamento: 'pago',
            forma_pagamento: norm(matchBanco.descricao).includes('pix') ? 'banco_pix' : 'banco_transferencia',
            lancamento_bancario_id: matchBanco.id, valor_pago: i.valor_total || 0,
          });
          await svc.VinculoExtrato.create({
            lancamento_bancario_id: matchBanco.id, entidade_tipo: 'ItemCompra', entidade_id: i.id,
            valor_alocado: i.valor_total || 0, tipo_vinculo: 'pagamento_integral',
            conciliado_por: 'auto', confianca: 95,
            observacao: `Compra NF ${itens[0].numero_nota || '—'} · ${fornecedor}`,
          });
        }
        await svc.LancamentoBancario.update(matchBanco.id, {
          status_conciliacao: 'conciliado',
          vinculos_count: (matchBanco.vinculos_count || 0) + itens.length,
          valor_conciliado: (matchBanco.valor_conciliado || 0) + valorNota,
        });
        bancoUsado.add(matchBanco.id);
        autoBanco++;
        detalhes.push({ via: 'banco', fornecedor, nota: itens[0].numero_nota, valor: valorNota });
        continue;
      }

      // 3) SUGESTÃO — valor bate na janela mas nome não confere (só extrato)
      const candidato = lancBanc.find(l => {
        if (l.valor >= 0 || bancoUsado.has(l.id)) return false;
        if (l.categoria !== 'fornecedor') return false;
        if (Math.abs(Math.abs(l.valor) - valorNota) > TOL) return false;
        const d = diffDias(dataEmissao, l.data);
        return d >= -2 && d <= JANELA;
      });

      if (candidato) {
        await svc.SugestaoConciliacao.create({
          lancamento_bancario_id: candidato.id,
          entidade_tipo: 'ItemCompra',
          entidade_id: itens[0].id,
          descricao_conta: `NF ${itens[0].numero_nota || '—'} · ${itens.length} item(ns)`,
          fornecedor,
          valor_esperado: valorNota,
          valor_extrato: Math.abs(candidato.valor),
          data_vencimento: dataEmissao,
          data_extrato: candidato.data,
          descricao_extrato: candidato.descricao,
          diff_dias: Math.round(Math.abs(diffDias(dataEmissao, candidato.data))),
          confianca: 60,
          motivo: `Compra: valor da nota bate (R$ ${valorNota.toFixed(2)}), mas o nome no extrato não confere com o fornecedor`,
          status: 'pendente',
        });
        itens.forEach(i => sugestaoExistente.add(i.id));
        sugestoesCriadas++;
      }
    }

    return Response.json({
      success: true,
      auto_cartao: autoCartao,
      auto_banco: autoBanco,
      sugestoes_criadas: sugestoesCriadas,
      notas_analisadas: grupos.size,
      compras_abertas: comprasAbertas.length,
      detalhes: detalhes.slice(0, 50),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});