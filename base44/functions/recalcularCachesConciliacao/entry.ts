import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { diagnosticarCachesConciliacao } from '../../shared/fluxoConsolidado/conciliacaoCache.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;
    const [lancamentos, vinculos] = await Promise.all([
      svc.LancamentoBancario.list('-created_date', 20000),
      svc.VinculoExtrato.list('-created_date', 20000),
    ]);
    const diagnostico = diagnosticarCachesConciliacao(lancamentos, vinculos);
    if (body.dry_run !== false) return Response.json({ success: true, dry_run: true, divergencias: diagnostico.divergencias });
    for (let i = 0; i < diagnostico.correcoes.length; i += 500) await svc.LancamentoBancario.bulkUpdate(diagnostico.correcoes.slice(i, i + 500));
    return Response.json({ success: true, aplicado: true, corrigidos: diagnostico.divergencias, fonte: diagnostico.fonte });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}