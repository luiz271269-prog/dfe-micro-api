import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

// Consolida TUDO que é pró-labore / retirada / gasto pessoal do sócio, cruzando 3 fontes:
//   1. LancamentoBancario com categoria = 'pro_labore' (retiradas formais no extrato)
//   2. LancamentoBancario com categoria = 'pessoal'? NÃO — 'pessoal' = folha (despesa da empresa). Fica de fora.
//   3. LancamentoCartao com natureza = 'pessoal' (gastos pessoais em QUALQUER cartão)
//
// Folha de pagamento de funcionários é despesa da empresa e NÃO entra aqui — fica na página Folha de Pagamento.
//
// Payload opcional: { mes_referencia?: 'YYYY-MM' }  — sem mês = todos os meses (visão anual).

function mesDe(dataStr, mesRef) {
  return mesRef || (dataStr ? String(dataStr).slice(0, 7) : null);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mesFiltro = body.mes_referencia || null;

    const svc = base44.asServiceRole.entities;
    const [lancBancarios, lancCartoes, cartoes] = await Promise.all([
      svc.LancamentoBancario.list('-data', 5000),
      svc.LancamentoCartao.list('-data_lancamento', 5000),
      svc.ContaCartao.list(),
    ]);

    const cartaoPorId = new Map(cartoes.map(c => [c.id, c]));
    const noMes = (m) => !mesFiltro || m === mesFiltro;

    // ─── FONTE 1: Retiradas no extrato (pro_labore) ───
    const retiradasExtrato = lancBancarios
      .filter(l => l.categoria === 'pro_labore')
      .map(l => ({
        origem: 'extrato',
        id: l.id,
        data: l.data,
        mes: mesDe(l.data, l.mes_referencia),
        descricao: l.descricao,
        conta: l.conta_bancaria,
        valor: Math.abs(l.valor || 0),
      }))
      .filter(x => noMes(x.mes));

    // ─── FONTE 2: Gastos pessoais nos cartões (natureza = 'pessoal') ───
    // Ignora pagamentos de fatura (valor negativo = crédito/estorno) e itens marcados como não-contabilizados.
    const gastosCartao = lancCartoes
      .filter(l => l.natureza === 'pessoal')
      .filter(l => (l.valor || 0) > 0)
      .filter(l => !(l.observacao || '').includes('Não faz parte'))
      .map(l => ({
        origem: 'cartao',
        id: l.id,
        data: l.data_lancamento,
        mes: mesDe(l.data_lancamento),
        descricao: l.estabelecimento,
        categoria: l.categoria,
        fatura_id: l.fatura_id,
        valor: l.valor || 0,
      }))
      .filter(x => noMes(x.mes));

    // ─── Totais ───
    const soma = arr => Math.round(arr.reduce((s, x) => s + (x.valor || 0), 0) * 100) / 100;
    const totalRetiradas = soma(retiradasExtrato);
    const totalCartao = soma(gastosCartao);
    const totalProLabore = Math.round((totalRetiradas + totalCartao) * 100) / 100;

    // ─── Breakdown por cartão (qual cartão concentra mais gasto pessoal) ───
    // Resolve cartão via fatura -> conta_cartao_id
    const faturas = await svc.FaturaCartao.list('-data_vencimento', 2000);
    const faturaParaCartao = new Map(faturas.map(f => [f.id, f.conta_cartao_id]));
    const porCartao = {};
    for (const g of gastosCartao) {
      const cartaoId = faturaParaCartao.get(g.fatura_id);
      const cartao = cartaoPorId.get(cartaoId);
      const nome = cartao?.nome || 'Cartão não identificado';
      if (!porCartao[nome]) porCartao[nome] = { cartao: nome, valor: 0, lancamentos: 0 };
      porCartao[nome].valor += g.valor;
      porCartao[nome].lancamentos += 1;
    }
    const rankingCartoes = Object.values(porCartao)
      .map(c => ({ ...c, valor: Math.round(c.valor * 100) / 100 }))
      .sort((a, b) => b.valor - a.valor);

    // ─── Breakdown por mês (linha do tempo) ───
    const porMes = {};
    [...retiradasExtrato, ...gastosCartao].forEach(x => {
      if (!x.mes) return;
      if (!porMes[x.mes]) porMes[x.mes] = { mes: x.mes, extrato: 0, cartao: 0, total: 0 };
      if (x.origem === 'extrato') porMes[x.mes].extrato += x.valor;
      else porMes[x.mes].cartao += x.valor;
      porMes[x.mes].total += x.valor;
    });
    const timeline = Object.values(porMes)
      .map(m => ({ mes: m.mes, extrato: Math.round(m.extrato * 100) / 100, cartao: Math.round(m.cartao * 100) / 100, total: Math.round(m.total * 100) / 100 }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    return Response.json({
      mes_referencia: mesFiltro,
      pro_labore: {
        total: totalProLabore,
        retiradas_extrato: { total: totalRetiradas, itens: retiradasExtrato.sort((a, b) => (b.data || '').localeCompare(a.data || '')) },
        gastos_cartao: { total: totalCartao, itens: gastosCartao.sort((a, b) => (b.data || '').localeCompare(a.data || '')) },
      },
      ranking_cartoes: rankingCartoes,
      timeline,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});