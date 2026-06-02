import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Concilia pagamentos de fatura de cartão no extrato bancário com as FaturaCartao abertas.
// Match: conta bancária + janela de ±7 dias do vencimento + valor com tolerância 1%.
// Cria VinculoExtrato (pagamento_integral ou parcial) e marca a fatura como paga.

function dentroDaJanela(dataLanc, dataVenc, dias = 7) {
  if (!dataLanc || !dataVenc) return false;
  const d1 = new Date(dataLanc).getTime();
  const d2 = new Date(dataVenc).getTime();
  return Math.abs(d1 - d2) <= dias * 86400000;
}

function nomeCartaoBate(descricao, cartao) {
  if (!descricao || !cartao) return false;
  const d = descricao.toUpperCase();
  const nome = (cartao.nome || '').toUpperCase();
  const bandeira = (cartao.bandeira || '').toUpperCase();
  const titular = (cartao.titular || '').toUpperCase();
  // tokens significativos do nome (sem o caractere '—')
  const tokens = nome.replace(/—/g, ' ').split(/\s+/).filter(t => t.length >= 4);
  if (tokens.some(t => d.includes(t))) return true;
  if (bandeira && d.includes(bandeira)) return true;
  if (titular && titular.length >= 4 && d.includes(titular)) return true;
  // Magalu/LuizaCred: extras
  if (bandeira === 'MAGALU' && (d.includes('LUIZACRED') || d.includes('MAGALU'))) return true;
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [cartoes, faturas, lancamentos, vinculos] = await Promise.all([
      base44.asServiceRole.entities.ContaCartao.list(),
      base44.asServiceRole.entities.FaturaCartao.list(),
      base44.asServiceRole.entities.LancamentoBancario.list('', 5000),
      base44.asServiceRole.entities.VinculoExtrato.filter({ entidade_tipo: 'FaturaCartao' }).catch(() => []),
    ]);

    const cartaoPorId = new Map(cartoes.map(c => [c.id, c]));
    const faturasAbertas = faturas.filter(f => f.status !== 'paga_total');
    // lançamentos de saída (valor negativo) — pagamentos
    const saidas = lancamentos.filter(l => (l.valor || 0) < 0);
    const lancVinculados = new Set(vinculos.map(v => v.lancamento_bancario_id));

    let conciliados = 0, naoConciliados = 0, atualizadas = 0;
    const detalhes = [];

    for (const fat of faturasAbertas) {
      const cartao = cartaoPorId.get(fat.conta_cartao_id);
      if (!cartao) { naoConciliados++; continue; }

      const contaPag = (cartao.conta_bancaria_pagamento || '').toUpperCase();

      // Candidatos: saídas na mesma conta de pagamento, dentro da janela do vencimento
      const candidatos = saidas.filter(l => {
        if (lancVinculados.has(l.id)) return false;
        const conta = (l.conta_bancaria || '').toUpperCase();
        if (contaPag && !conta.includes(contaPag.split(' ')[0])) {
          // fallback: tenta bater por nome do cartão na descrição
          if (!nomeCartaoBate(l.descricao, cartao)) return false;
        }
        if (!dentroDaJanela(l.data, fat.data_vencimento, 7)) return false;
        return true;
      });

      // Best match: valor mais próximo do valor_total da fatura (tolerância 2%)
      let melhor = null;
      let melhorDiff = Infinity;
      for (const c of candidatos) {
        const absV = Math.abs(c.valor || 0);
        const diff = Math.abs(absV - (fat.valor_total || 0));
        const tol = Math.max(5, (fat.valor_total || 0) * 0.02);
        if (diff <= tol && diff < melhorDiff) {
          melhor = c;
          melhorDiff = diff;
        }
      }

      // Segunda passada: também aceita match por nome do cartão (sem checar conta)
      if (!melhor) {
        for (const c of saidas) {
          if (lancVinculados.has(c.id)) continue;
          if (!nomeCartaoBate(c.descricao, cartao)) continue;
          if (!dentroDaJanela(c.data, fat.data_vencimento, 7)) continue;
          const absV = Math.abs(c.valor || 0);
          const diff = Math.abs(absV - (fat.valor_total || 0));
          const tol = Math.max(5, (fat.valor_total || 0) * 0.02);
          if (diff <= tol && diff < melhorDiff) {
            melhor = c;
            melhorDiff = diff;
          }
        }
      }

      if (!melhor) { naoConciliados++; continue; }

      const valorPago = Math.abs(melhor.valor || 0);
      const integral = Math.abs(valorPago - (fat.valor_total || 0)) <= Math.max(1, (fat.valor_total || 0) * 0.01);

      // Cria vínculo
      await base44.asServiceRole.entities.VinculoExtrato.create({
        lancamento_bancario_id: melhor.id,
        entidade_tipo: 'FaturaCartao',
        entidade_id: fat.id,
        valor_alocado: valorPago,
        tipo_vinculo: integral ? 'pagamento_integral' : 'pagamento_parcial',
        conciliado_por: 'auto',
        confianca: integral ? 95 : 80,
      });
      lancVinculados.add(melhor.id);

      // Atualiza fatura
      await base44.asServiceRole.entities.FaturaCartao.update(fat.id, {
        status: integral ? 'paga_total' : 'aberta',
        data_pagamento: melhor.data,
        valor_pago: valorPago,
      });

      conciliados++;
      if (integral) atualizadas++;
      detalhes.push({
        cartao: cartao.nome,
        mes: fat.mes_referencia,
        valor_fatura: fat.valor_total,
        valor_pago: valorPago,
        data_pagamento: melhor.data,
        descricao_extrato: melhor.descricao,
        tipo: integral ? 'integral' : 'parcial',
      });
    }

    return Response.json({
      sucesso: true,
      faturas_abertas: faturasAbertas.length,
      conciliados,
      nao_conciliados: naoConciliados,
      atualizadas_pagas: atualizadas,
      detalhes,
    });
  } catch (err) {
    console.error('Erro conciliarFaturasCartao:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});