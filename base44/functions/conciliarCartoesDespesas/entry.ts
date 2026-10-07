import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { secrets } from 'base44:runtime';
import { conciliarComprasCartao } from '../../shared/conciliacaoCartaoMotor.ts';
export default async function(req) {
  try {
    const base44=createClientFromRequest(req);
    const payload=await req.json().catch(()=>({}));
    const token=secrets.get('NEXUS_HUB_TOKEN');
    const interno=Boolean(token && payload.internal_token===token);
    const user=interno ? null : await base44.auth.me();
    if (!interno && (!user || user.role!=='admin')) return Response.json({error:'Forbidden'},{status:403});
    return Response.json(await conciliarComprasCartao(interno ? base44.asServiceRole.entities : base44.entities,payload,user?.id || 'pipeline'));
  } catch(error) { return Response.json({error:error.message},{status:400}); }
}