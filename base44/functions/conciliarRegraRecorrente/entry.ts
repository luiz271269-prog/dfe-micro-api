import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { confirmarDespesaFixa } from '../../shared/despesaFixaConfirmar.ts';
export default async function(req) {
  try {
    const base44=createClientFromRequest(req),user=await base44.auth.me();
    if(!user)return Response.json({error:'Não autenticado'},{status:401});
    if(user.role!=='admin')return Response.json({error:'Apenas administradores podem conciliar'},{status:403});
    const body=await req.json();
    if(body.validate_only)return Response.json({success:true,mode:'validation'});
    if(typeof body.regra_id!=='string'||typeof body.lancamento_id!=='string'||body.regra_id.length>100||body.lancamento_id.length>100)throw new Error('Informe a regra e o lançamento.');
    return Response.json(await confirmarDespesaFixa(base44,body,user.id));
  }catch(error){return Response.json({error:error.message},{status:409});}
}