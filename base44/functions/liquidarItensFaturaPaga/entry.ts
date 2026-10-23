import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { fatura_id, dry_run = false } = await req.json().catch(() => ({}));
    if (fatura_id != null && (typeof fatura_id !== 'string' || fatura_id.length > 200)) return Response.json({ error: 'Fatura inválida.' }, { status: 400 });
    // Compatibilidade com chamadas antigas e execuções já iniciadas: nenhuma escrita.
    return Response.json({ success: true, dry_run, descontinuado: true, modelo: 'composicao_separada_do_pagamento', historico_preservado: true, faturas_processadas: 0, filhos_atualizados: 0, despesas_baixadas: 0, compras_baixadas: 0, obras_classificadas: 0, mensagem: 'O pagamento altera somente a fatura. Os documentos permanecem como composição, sem propagação de baixa.' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}