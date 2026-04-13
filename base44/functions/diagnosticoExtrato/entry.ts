import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const lancamentos = await base44.asServiceRole.entities.LancamentoBancario.list('-data', 1000);
  const abril = lancamentos.filter(l => (l.mes_referencia || (l.data || '').slice(0, 7)) === '2026-04');

  // Separar por data: até 13/04 (extrato oficial) vs após 13/04 (futuro/suspeito)
  const hoje = '2026-04-13';
  const ate13 = abril.filter(l => l.data <= hoje);
  const apos13 = abril.filter(l => l.data > hoje);

  // Resumo até 13/04
  const totalAte13 = ate13.reduce((s, l) => s + (l.valor || 0), 0);
  const entradasAte13 = ate13.filter(l => l.valor > 0).reduce((s, l) => s + l.valor, 0);
  const saidasAte13 = ate13.filter(l => l.valor < 0).reduce((s, l) => s + l.valor, 0);

  // Saldo final: pegar o último lançamento com saldo_apos (ordenado por data desc)
  const comSaldo = ate13.filter(l => l.saldo_apos != null).sort((a, b) => new Date(b.data) - new Date(a.data));
  const ultimoSaldo = comSaldo[0]?.saldo_apos;
  const ultimoSaldoData = comSaldo[0]?.data;
  const ultimoSaldoDesc = comSaldo[0]?.descricao;

  // Duplicatas semânticas (mesma data + valor negativo, descrição diferente)
  const seenValorData = {};
  const duplicatasSem = [];
  for (const l of ate13) {
    const key = `${l.data}|${l.valor}`;
    if (seenValorData[key] && l.valor < 0) {
      duplicatasSem.push({
        data: l.data,
        valor: l.valor,
        descricao_a: seenValorData[key].descricao,
        descricao_b: l.descricao,
        id_a: seenValorData[key].id,
        id_b: l.id,
      });
    } else {
      seenValorData[key] = l;
    }
  }

  // Lançamentos futuros (após 13/04) agrupados por data
  const futurosPorData = {};
  for (const l of apos13) {
    if (!futurosPorData[l.data]) futurosPorData[l.data] = [];
    futurosPorData[l.data].push({ descricao: l.descricao, valor: l.valor, id: l.id });
  }

  return Response.json({
    // Extrato oficial cobre até 13/04
    extrato_oficial: {
      periodo: '01/04/2026 a 13/04/2026',
      count: ate13.length,
      totalMovimentado: Math.round(totalAte13 * 100) / 100,
      entradas: Math.round(entradasAte13 * 100) / 100,
      saidas: Math.round(saidasAte13 * 100) / 100,
      ultimoSaldo,
      ultimoSaldoData,
      ultimoSaldoDesc,
    },
    // Saldo oficial do Sicredi (da imagem)
    saldo_sicredi_documento: 14718.09,
    saldo_bate: Math.abs((ultimoSaldo || 0) - 14718.09) < 0.02,
    // Lançamentos futuros suspeitos (data > hoje)
    lancamentos_futuros: {
      count: apos13.length,
      total: Math.round(apos13.reduce((s,l) => s + (l.valor||0), 0) * 100) / 100,
      porData: futurosPorData,
    },
    // Duplicatas semânticas até 13/04
    duplicatas_semanticas: {
      count: duplicatasSem.length,
      registros: duplicatasSem,
    },
  });
});