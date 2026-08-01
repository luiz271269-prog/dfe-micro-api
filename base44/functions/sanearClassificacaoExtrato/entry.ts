import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { eixosDoLancamento } from '../../shared/classificacaoPadrao.ts';

// Auto-saneamento: preenche os eixos unificados (origem_compra / tipo_compra)
// em lançamentos bancários importados que chegaram sem classificação.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const tokenInterno = Deno.env.get('NEXUS_HUB_TOKEN');
    const autorizadoPorToken = tokenInterno && body.internal_token === tokenInterno;

    if (!autorizadoPorToken) {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const svc = base44.asServiceRole.entities;
    const lancamentos = await svc.LancamentoBancario.list('-data', 10000);
    const pendentes = lancamentos.filter((l) => !l.origem_compra || !l.tipo_compra);

    const updates = pendentes.map((l) => ({ id: l.id, ...eixosDoLancamento(l) }));
    if (!body.dry_run) {
      for (let i = 0; i < updates.length; i += 100) {
        await svc.LancamentoBancario.bulkUpdate(updates.slice(i, i + 100));
      }
    }

    return Response.json({
      success: true,
      dry_run: !!body.dry_run,
      total: lancamentos.length,
      classificados: updates.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}