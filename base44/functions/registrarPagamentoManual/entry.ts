import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
    const { entidade, id, valor, data, forma, pedidoId } = await req.json();
    if (!['FolhaPagamento', 'FaturaCartao'].includes(entidade) || typeof id !== 'string' || !id || typeof pedidoId !== 'string' || pedidoId.length > 80 || !pedidoId) return Response.json({ error: 'Obrigação ou identificação inválida.' }, { status: 400 });
    if (entidade === 'FolhaPagamento' && user.role !== 'admin') return Response.json({ error: 'Acesso restrito à folha.' }, { status: 403 });
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(Date.parse(data)) || new Date(data).toISOString().slice(0, 10) !== data || data > hoje || !['pix','transferencia','dinheiro','cheque','cartao','deposito','boleto','debito_automatico'].includes(forma) || (entidade === 'FolhaPagamento' && ['boleto','debito_automatico'].includes(forma))) return Response.json({ error: 'Informe a data real do pagamento e uma forma válida.' }, { status: 400 });
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) return Response.json({ error: 'Informe um pagamento positivo.' }, { status: 400 });
    const api = base44.entities[entidade];
    const registro = await api.get(id);
    const historico = registro.pagamentos_manuais || [];
    if (historico.some(p => p.id === pedidoId)) return Response.json({ ok: true, repetido: true });
    const total = Math.round(Number(entidade === 'FolhaPagamento' ? registro.salario_liquido : registro.valor_total) * 100);
    const pago = Math.round(Number(registro.valor_pago || 0) * 100);
    const centavos = Math.round(valor * 100);
    if (!Number.isFinite(total) || !Number.isFinite(pago) || centavos <= 0 || centavos > total - pago || ['pago','paga_total'].includes(registro.status)) return Response.json({ error: 'Valor superior ao saldo ou obrigação já quitada. Atualize antes de continuar.' }, { status: 409 });
    const novoPago = pago + centavos;
    const quitado = novoPago === total;
    await api.update(id, {
      valor_pago: novoPago / 100,
      data_pagamento: [registro.data_pagamento || '', data].sort().at(-1),
      status: entidade === 'FolhaPagamento' ? (quitado ? 'pago' : 'adiantamento') : (quitado ? 'paga_total' : registro.data_vencimento < hoje ? 'vencida' : 'aberta'),
      ...(entidade === 'FolhaPagamento' ? { forma_pagamento: forma } : {}),
      pagamentos_manuais: [...historico, { id: pedidoId, data, valor: centavos / 100, forma, registrado_em: new Date().toISOString(), usuario_id: user.id }],
    });
    return Response.json({ ok: true, valor_pago: novoPago / 100, saldo: (total - novoPago) / 100, quitado });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}