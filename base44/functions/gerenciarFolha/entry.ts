import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { validarNovaFolha, criarFolhaValidada, resolverFuncionario, queryFuncionario, impedimentoFolha } from '../../shared/folhaRegras.ts';

export default async function(req) {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const entities = client.entities;
    const { action, data, id, competencia, cursor } = await req.json();
    if (action === 'ausentes') {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia || '')) return Response.json({ error: 'Competência inválida.' }, { status: 400 });
      const [ano, mes] = competencia.split('-').map(Number);
      const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
      const page = await entities.Funcionario.filter({ data_admissao: { $lte: fim }, $or: [{ data_demissao: { $exists: false } }, { data_demissao: '' }, { data_demissao: null }, { data_demissao: { $gte: competencia + '-01' } }] }, { sort: 'nome', limit: 50, cursor });
      const items = [];
      for (let i = 0; i < page.items.length; i += 3) {
        const batch = await Promise.all(page.items.slice(i, i + 3).map(async func => {
          if (await impedimentoFolha(entities, func, competencia)) return null;
          const count = await entities.FolhaPagamento.count({ ...queryFuncionario(func), competencia });
          return count ? null : func;
        }));
        items.push(...batch.filter(Boolean));
      }
      return Response.json({ items, has_more: page.has_more, next_cursor: page.next_cursor });
    }
    if (action === 'excluir') {
      if (typeof id !== 'string' || !id) return Response.json({ error: 'Selecione a folha.' }, { status: 400 });
      const folha = await entities.FolhaPagamento.get(id);
      const func = await resolverFuncionario(entities, folha);
      const [quantidade, vinculos, sugestoes] = await Promise.all([
        entities.FolhaPagamento.count({ ...queryFuncionario(func), competencia: folha.competencia }),
        entities.VinculoExtrato.count({ entidade_tipo: 'FolhaPagamento', entidade_id: id }),
        entities.SugestaoConciliacao.count({ entidade_tipo: 'FolhaPagamento', entidade_id: id }),
      ]);
      if (quantidade < 2) throw new Error('Não há duplicidade: a única folha do mês não pode ser excluída por esta ação.');
      if (folha.status === 'pago' || folha.status === 'adiantamento' || folha.valor_pago > 0 || folha.pagamentos_manuais?.length || folha.lancamento_bancario_id || vinculos || sugestoes) throw new Error('Esta folha possui pagamento ou vínculo de conciliação. Resolva os vínculos antes de excluir.');
      const refs = await Promise.all(['RescisaoFuncionario', 'FeriasFuncionario'].map(async name => {
        const page = await entities[name].filter({ folha_pagamento_id: id }, { limit: 50 });
        if (page.has_more) throw new Error('Há muitos vínculos; revise o cadastro antes de excluir.');
        if (page.items.some(r => r.status === 'paga' || r.valor_pago > 0 || r.lancamento_bancario_id)) throw new Error('Há férias ou rescisão paga vinculada a esta folha.');
        return { name, items: page.items };
      }));
      for (const ref of refs) for (const item of ref.items) await entities[ref.name].update(item.id, { folha_pagamento_id: '' });
      await entities.FolhaPagamento.delete(id);
      return Response.json({ ok: true });
    }
    if (!['validar', 'criar'].includes(action) || !data || typeof data !== 'object') return Response.json({ error: 'Operação inválida.' }, { status: 400 });
    if (action === 'validar') { await validarNovaFolha(entities, data); return Response.json({ ok: true }); }
    const fields = ['funcionario_id','funcionario_nome','competencia','tipo','salario_bruto','desconto_inss','desconto_irrf','desconto_vt','desconto_vr','outros_descontos','horas_extras','comissao','eventos','salario_liquido','data_pagamento','valor_pago','forma_pagamento','status','fgts_valor','empresa','origem_compra','tipo_compra'];
    const payload = Object.fromEntries(fields.filter(k => data[k] !== undefined).map(k => [k, data[k]]));
    if (!Number.isFinite(payload.salario_bruto) || !Number.isFinite(payload.salario_liquido) || (payload.eventos && (!Array.isArray(payload.eventos) || payload.eventos.length > 200))) return Response.json({ error: 'Valores da folha inválidos.' }, { status: 400 });
    const folha = await criarFolhaValidada(entities, payload);
    return Response.json({ ok: true, folha });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}