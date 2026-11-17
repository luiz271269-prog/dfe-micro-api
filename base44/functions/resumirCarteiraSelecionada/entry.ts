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
      const faturasPeriodo = body.acao === 'resumo_faturas' ? await lerCompleto(base44.entities, 'FaturaCartao', { mes_referencia: body.anual ? { $regex: `^${body.mes.slice(0, 4)}-` } : body.mes }) : [];
      const selecao = body.acao === 'resumo_faturas' ? { FaturaCartao: faturasPeriodo.map(r => r.id) } : body;
      const liquidacoes = {};
      for (const nome of ['ObraReforma', 'FaturaCartao']) {
        const ids = selecao[nome] || [];
        if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id => typeof id !== 'string' || !id || id.length > 100)) return Response.json({ error: 'Seleção inválida.' }, { status: 400 });
        const rows = await liquidacoesDocumentos(base44.entities, nome, [...new Set(ids)]);
        liquidacoes[nome] = Object.fromEntries(rows.map(r => [r.id, r]));
      }
      const resumo = Object.values(liquidacoes.FaturaCartao).reduce((s, r) => ({ total: s.total + r.total, pago: s.pago + r.pago_considerado, saldo: s.saldo + r.saldo, quantidade: s.quantidade + 1, revisao: s.revisao + (r.revisao ? 1 : 0) }), { total: 0, pago: 0, saldo: 0, quantidade: 0, revisao: 0 });
      for (const campo of ['total', 'pago', 'saldo']) resumo[campo] = Math.round(resumo[campo] * 100) / 100;
      const faturas = faturasPeriodo.map(f => ({ id: f.id, conta_cartao_id: f.conta_cartao_id, mes_referencia: f.mes_referencia, data_vencimento: f.data_vencimento, ...liquidacoes.FaturaCartao[f.id] }));
      const filtros = { todas: faturas.length, pagas: faturas.filter(f => f.pago_considerado > 0).length, abertas: faturas.filter(f => f.saldo > 0).length, parciais: faturas.filter(f => f.liquidacao === 'Parcial').length, revisao: faturas.filter(f => f.revisao).length };
      const filtro = body.filtro_faturas || 'todas', offset = body.offset || 0;
      if (!['todas', 'pagas', 'abertas', 'parciais', 'revisao'].includes(filtro) || !Number.isInteger(offset) || offset < 0 || offset > 1000) return Response.json({ error: 'Filtro ou página inválidos.' }, { status: 400 });
      const cartoes = body.detalhar ? await lerCompleto(base44.entities, 'ContaCartao', body.somente_ativos ? { is_ativo: true } : {}) : [];
      const idsCartoes = new Set(cartoes.map(c => c.id));
      const escopoFaturas = faturas.filter(f => !body.somente_ativos || idsCartoes.has(f.conta_cartao_id));
      if (body.somente_ativos) Object.assign(filtros, { todas: escopoFaturas.length, pagas: escopoFaturas.filter(f => f.pago_considerado > 0).length, abertas: escopoFaturas.filter(f => f.saldo > 0).length, parciais: escopoFaturas.filter(f => f.liquidacao === 'Parcial').length, revisao: escopoFaturas.filter(f => f.revisao).length });
      const elegiveis = escopoFaturas.filter(f => (filtro === 'todas' || filtro === 'pagas' && f.pago_considerado > 0 || filtro === 'abertas' && f.saldo > 0 || filtro === 'parciais' && f.liquidacao === 'Parcial' || filtro === 'revisao' && f.revisao)).sort((a, b) => a.conta_cartao_id.localeCompare(b.conta_cartao_id) || a.mes_referencia.localeCompare(b.mes_referencia) || a.id.localeCompare(b.id));
      return Response.json({ somente_leitura: true, liquidacoes, resumo, faturas: body.detalhar ? elegiveis.slice(offset, offset + 10) : faturas, filtros, cartoes: cartoes.map(c => ({ id: c.id, nome: c.nome })), sem_fatura: body.somente_ativos ? cartoes.filter(c => !faturas.some(f => f.conta_cartao_id === c.id)).map(c => ({ id: c.id, nome: c.nome })) : [], quantidade_filtrada: elegiveis.length, has_more: elegiveis.length > offset + 10 });
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