import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { analisarHistoricoCartoes } from '../../shared/historicoClassificacaoCartoes.ts';
export default async function(req) {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    const { meses, offset = 0, limit = 25 } = await req.json();
    if (!Array.isArray(meses) || !meses.length || meses.length > 3 || meses.some(m => typeof m !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(m))) return Response.json({ error: 'Selecione de um a três meses válidos.' }, { status: 400 });
    if (!Number.isInteger(offset) || offset < 0 || offset > 1000 || !Number.isInteger(limit) || limit < 1 || limit > 25) return Response.json({ error: 'Página de revisão inválida.' }, { status: 400 });
    return Response.json(await analisarHistoricoCartoes(client.entities, [...new Set(meses)], user.role, offset, limit));
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}