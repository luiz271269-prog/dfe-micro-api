import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { registrarDeclarado } from '../../shared/baixasDeclaradas.ts';
export default async function(req) {
  try {
    const base44=createClientFromRequest(req),user=await base44.auth.me();
    if(!user)return Response.json({error:'Não autorizado.'},{status:401});
    return Response.json(await registrarDeclarado(base44,user,await req.json()));
  } catch(error){return Response.json({error:error.message},{status:422});}
}