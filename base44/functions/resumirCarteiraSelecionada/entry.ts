import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { liquidacoesDocumentos } from '../../shared/liquidacaoObrasFaturas.ts';
import { lerCompleto } from '../../shared/conciliacaoLeitura.ts';

const FONTES = {
  DespesaOperacional: { sum: ['valor', 'valor_pago'], original: 'sum_valor' },
  Tributo: { sum: ['valor_original', 'valor_pago', 'juros_multa'], original: 'sum_valor_original' },
  FolhaPagamento: { sum: ['salario_liquido', 'valor_pago'], original: 'sum_salario_liquido' },
  FaturaCartao: { sum: ['valor_total', 'valor_pago'], original: 'sum_valor_total' },
  ItemCompra: { sum: ['valor_total', 'valor_pago'], original: 'sum_valor_total', groupBy: ['fornecedor', 'numero_nota', 'data_vencimento'] },
  ObraReforma: { sum: ['valor'], original: 'sum_valor' },
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body.acao === 'liquidacoes' || body.acao === 'resumo_faturas') {
      if (body.acao === 'resumo_faturas' && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.mes || '') || typeof body.anual !== 'boolean')) return Response.json({ error: 'Período inválido.' }, { status: 400 });
      const selecao = body.acao === 'resumo_faturas' ? { FaturaCartao: (await lerCompleto(base44.entities, 'FaturaCartao', { mes_referencia: body.anual ? { $regex: `^${body.mes.slice(0, 4)}-` } : body.mes })).map(r => r.id) } : body;
      const liquidacoes = {};
      for (const nome of ['ObraReforma', 'FaturaCartao']) {
        const ids = selecao[nome] || [];
        if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id => typeof id !== 'string' || !id || id.length > 100)) return Response.json({ error: 'Seleção inválida.' }, { status: 400 });
        const rows = await liquidacoesDocumentos(base44.entities, nome, [...new Set(ids)]);
        liquidacoes[nome] = Object.fromEntries(rows.map(r => [r.id, r]));
      }
      const resumo = Object.values(liquidacoes.FaturaCartao).reduce((s, r) => ({ total: s.total + r.total, pago: s.pago + r.pago_considerado, saldo: s.saldo + r.saldo, quantidade: s.quantidade + 1, revisao: s.revisao + (r.revisao ? 1 : 0) }), { total: 0, pago: 0, saldo: 0, quantidade: 0, revisao: 0 });
      for (const campo of ['total', 'pago', 'saldo']) resumo[campo] = Math.round(resumo[campo] * 100) / 100;
      return Response.json({ somente_leitura: true, liquidacoes, resumo });
    }
    if (body.acao) return Response.json({ error: 'Ação inválida.' }, { status: 400 });
    const tarefas = [];
    for (const situacao of ['aberto', 'pago']) {
      const fontes = body[situacao] || {};
      if (typeof fontes !== 'object' || Array.isArray(fontes)) return Response.json({ error: 'Carteira inválida.' }, { status: 400 });
      for (const [nome, ids] of Object.entries(fontes)) {
        if (!FONTES[nome] || !Array.isArray(ids) || ids.length > 6000 || ids.some(id => typeof id !== 'string' || !id || id.length > 100)) return Response.json({ error: 'Seleção inválida.' }, { status: 400 });
        if (ids.length) tarefas.push({ situacao, nome, ids: [...new Set(ids)] });
      }
    }
    const resultado = { aberto: { valor: 0, count: 0 }, pago: { valor: 0, count: 0 } };
    // Somente leitura e sempre sob as permissões do usuário. Não aceita valores financeiros do cliente.
    for (let i = 0; i < tarefas.length; i += 6) {
      const grupos = await Promise.all(tarefas.slice(i, i + 6).map(async tarefa => {
        const cfg = FONTES[tarefa.nome];
        if (['ObraReforma', 'FaturaCartao'].includes(tarefa.nome)) return { ...tarefa, cfg, liquidacoes: await liquidacoesDocumentos(base44.entities, tarefa.nome, tarefa.ids) };
        const page = await base44.entities[tarefa.nome].aggregate({ query: { id: { $in: tarefa.ids } }, groupBy: cfg.groupBy || 'valor_pago', sum: cfg.sum, limit: 1000 });
        if (page.truncated) throw new Error('Seleção excede o limite seguro do resumo. Reduza o período.');
        return { ...tarefa, cfg, rows: page.rows };
      }));
      for (const grupo of grupos) {
        const destino = resultado[grupo.situacao];
        if (grupo.liquidacoes) {
          for (const row of grupo.liquidacoes) {
            if (grupo.situacao === 'aberto' ? row.saldo <= 0 : row.liquidacao !== 'Quitada') continue;
            destino.valor += grupo.situacao === 'pago' ? Math.max(0, row.total) : row.saldo;
            destino.count++;
          }
          continue;
        }
        for (const row of grupo.rows) {
          const original = Number(row[grupo.cfg.original]) || 0;
          const juros = grupo.nome === 'Tributo' ? Number(row.sum_juros_multa) || 0 : 0;
          const pago = Number(row.sum_valor_pago) || 0;
          // Quitados representam o valor nominal do documento; não são um relatório de desembolso.
          destino.valor += grupo.situacao === 'pago' ? original : Math.max(0, original + juros - pago);
          destino.count += grupo.nome === 'ItemCompra' ? 1 : row.count;
        }
      }
    }
    for (const item of Object.values(resultado)) item.valor = Math.round(item.valor * 100) / 100;
    return Response.json(resultado);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}