import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { MODULOS_BAIXA } from '../../shared/baixasContrato.ts';
import { consultarListaBaixas,detalheBaixas } from '../../shared/baixasConsulta.ts';
import { candidatosBaixas } from '../../shared/baixasSemelhanca.ts';
import { executarBaixaCentral } from '../../shared/baixasOperacoes.ts';
export default async function(req) {
  try {
    const base44=createClientFromRequest(req),user=await base44.auth.me();
    if(!user)return Response.json({error:'Não autorizado.'},{status:401});
    const b=await req.json();
    if(b.acao==='listar')return Response.json({...await consultarListaBaixas(base44.entities,b),admin:user.role==='admin'});
    if(!MODULOS_BAIXA[b.tipo]||typeof b.id!=='string'||!b.id||b.id.length>200)return Response.json({error:'Registro inválido.'},{status:400});
    if(b.acao==='detalhe')return Response.json(await detalheBaixas(base44,user,b.tipo,b.id));
    if(b.acao==='candidatos')return Response.json(await candidatosBaixas(base44,user,b));
    if(user.role!=='admin')return Response.json({error:'Alterações na central são restritas a administrador; as permissões dos módulos permanecem inalteradas.'},{status:403});
    if(typeof b.pedidoId!=='string'||!b.pedidoId||b.pedidoId.length>80||typeof b.motivo!=='string'||b.motivo.trim().length<10||b.motivo.length>500)return Response.json({error:'Identifique a operação e descreva a evidência/motivo (10 a 500 caracteres).'},{status:400});
    if(b.validate_only)return Response.json({ok:true,modo:'validacao'});
    return Response.json(await executarBaixaCentral(base44,user,b));
  } catch(error){return Response.json({error:error.message},{status:422});}
}