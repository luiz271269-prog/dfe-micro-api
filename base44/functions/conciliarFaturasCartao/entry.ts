import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

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
    const body = await req.json().catch(() => ({}));
    const internoOk = !!body?.internal_token && body.internal_token === Deno.env.get('NEXUS_HUB_TOKEN');
    if (!internoOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [cartoes, faturas, lancamentos, vinculos] = await Promise.all([
      base44.asServiceRole.entities.ContaCartao.list(),
      base44.asServiceRole.entities.FaturaCartao.list(),
      base44.asServiceRole.entities.LancamentoBancario.list('', 5000),
      base44.asServiceRole.entities.VinculoExtrato.filter({ entidade_tipo: 'FaturaCartao' }).catch(() => []),
    ]);

    const cartaoPorId = new Map(cartoes.map(c => [c.id, c]));
    // Reconcilia TODAS as faturas que ainda não têm vínculo (mesmo as marcadas como pagas sem vínculo)
    const fatComVinculo = new Set(vinculos.map(v => v.entidade_id));
    const faturasAbertas = faturas.filter(f => !fatComVinculo.has(f.id));
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
        if (!dentroDaJanela(l.data, fat.data_vencimento, 14)) return false;
        return true;
      });

      const valorFat = fat.valor_total || 0;
      const tol = Math.max(10, valorFat * 0.05);

      // Best match individual
      let melhores = null;
      let melhorDiff = Infinity;
      for (const c of candidatos) {
        const diff = Math.abs(Math.abs(c.valor || 0) - valorFat);
        if (diff <= tol && diff < melhorDiff) {
          melhores = [c];
          melhorDiff = diff;
        }
      }

      // Segunda passada individual: match por nome do cartão (sem checar conta)
      if (!melhores) {
        for (const c of saidas) {
          if (lancVinculados.has(c.id)) continue;
          if (!nomeCartaoBate(c.descricao, cartao)) continue;
          if (!dentroDaJanela(c.data, fat.data_vencimento, 14)) continue;
          const diff = Math.abs(Math.abs(c.valor || 0) - valorFat);
          if (diff <= tol && diff < melhorDiff) {
            melhores = [c];
            melhorDiff = diff;
          }
        }
      }

      // Combinações de 2 ou 3 débitos que somam o valor da fatura (pagamento parcelado)
      if (!melhores) {
        const pool = candidatos.length > 0
          ? candidatos
          : saidas.filter(c => !lancVinculados.has(c.id) && nomeCartaoBate(c.descricao, cartao) && dentroDaJanela(c.data, fat.data_vencimento, 14));
        // Limita combinatória
        const lim = pool.slice(0, 25);
        // Pares
        outer2: for (let i = 0; i < lim.length && !melhores; i++) {
          for (let j = i + 1; j < lim.length; j++) {
            const soma = Math.abs(lim[i].valor || 0) + Math.abs(lim[j].valor || 0);
            const diff = Math.abs(soma - valorFat);
            if (diff <= tol) { melhores = [lim[i], lim[j]]; melhorDiff = diff; break outer2; }
          }
        }
        // Trios
        if (!melhores) {
          outer3: for (let i = 0; i < lim.length && !melhores; i++) {
            for (let j = i + 1; j < lim.length; j++) {
              for (let k = j + 1; k < lim.length; k++) {
                const soma = Math.abs(lim[i].valor || 0) + Math.abs(lim[j].valor || 0) + Math.abs(lim[k].valor || 0);
                const diff = Math.abs(soma - valorFat);
                if (diff <= tol) { melhores = [lim[i], lim[j], lim[k]]; melhorDiff = diff; break outer3; }
              }
            }
          }
        }
      }

      if (!melhores || melhores.length === 0) { naoConciliados++; continue; }

      const valorPagoTotal = melhores.reduce((s, m) => s + Math.abs(m.valor || 0), 0);
      const integral = Math.abs(valorPagoTotal - valorFat) <= Math.max(1, valorFat * 0.01);
      const dataUltima = melhores.map(m => m.data).sort().slice(-1)[0];
      const isMulti = melhores.length > 1;

      // Cria vínculos (um por lançamento)
      for (const m of melhores) {
        const valorM = Math.abs(m.valor || 0);
        await base44.asServiceRole.entities.VinculoExtrato.create({
          lancamento_bancario_id: m.id,
          entidade_tipo: 'FaturaCartao',
          entidade_id: fat.id,
          valor_alocado: valorM,
          tipo_vinculo: (isMulti || !integral) ? 'pagamento_parcial' : 'pagamento_integral',
          conciliado_por: 'auto',
          confianca: integral ? (isMulti ? 90 : 95) : 80,
          observacao: isMulti ? `Parte ${melhores.indexOf(m) + 1}/${melhores.length} do pagamento da fatura` : undefined,
        });
        lancVinculados.add(m.id);
      }

      // Atualiza fatura — FK direto só em pagamento 1:1; em multi-débito a verdade vive em VinculoExtrato
      await base44.asServiceRole.entities.FaturaCartao.update(fat.id, {
        status: integral ? 'paga_total' : 'aberta',
        data_pagamento: dataUltima,
        valor_pago: valorPagoTotal,
        lancamento_bancario_id: !isMulti ? melhores[0].id : null,
      });

      conciliados++;
      if (integral) atualizadas++;
      detalhes.push({
        cartao: cartao.nome,
        mes: fat.mes_referencia,
        valor_fatura: valorFat,
        valor_pago: valorPagoTotal,
        data_pagamento: dataUltima,
        descricao_extrato: melhores.map(m => m.descricao).join(' + '),
        tipo: integral ? (isMulti ? `integral (${melhores.length} débitos)` : 'integral') : 'parcial',
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