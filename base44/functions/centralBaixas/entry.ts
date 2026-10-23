import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { MODULOS_BAIXA } from '../../shared/baixasContrato.ts';
import { consultarListaBaixas,detalheBaixas } from '../../shared/baixasConsulta.ts';
import { candidatosBaixas } from '../../shared/baixasSemelhanca.ts';
import { executarBaixaCentral } from '../../shared/baixasOperacoes.ts';
import { revisarFixasCentral } from '../../shared/baixasFixas.ts';
import { movimentosDaObrigacao } from '../../shared/baixasMovimentos.ts';
export default async function(req) {
  try {
    const base44=createClientFromRequest(req),user=await base44.auth.me();
    if(!user)return Response.json({error:'Não autorizado.'},{status:401});
    const b=await req.json();
    if(['fixasListar','fixasAnalisar','fixasConfirmar','fixasRejeitar'].includes(b.acao))return Response.json(await revisarFixasCentral(base44,user,b));
    if(b.acao==='listar')return Response.json({...await consultarListaBaixas(base44.entities,b),admin:user.role==='admin'});
    if(!MODULOS_BAIXA[b.tipo]||typeof b.id!=='string'||!b.id||b.id.length>200)return Response.json({error:'Registro inválido.'},{status:400});
    if(b.acao==='detalhe')return Response.json(await detalheBaixas(base44,user,b.tipo,b.id));
    if(b.acao==='candidatos')return Response.json(await candidatosBaixas(base44,user,b));
    if(b.acao==='movimentos')return Response.json(await movimentosDaObrigacao(base44,user,b));
    if(user.role!=='admin'&&!(b.acao==='manual'&&b.tipo==='FaturaCartao'))return Response.json({error:'Operação restrita a administrador. O pagamento declarado de faturas mantém a permissão do módulo de cartões.'},{status:403});
    if(typeof b.pedidoId!=='string'||!b.pedidoId||b.pedidoId.length>80||typeof b.motivo!=='string'||b.motivo.trim().length<10||b.motivo.length>500)return Response.json({error:'Identifique a operação e descreva a evidência/motivo (10 a 500 caracteres).'},{status:400});
    if(b.validate_only)return Response.json({ok:true,modo:'validacao'});
    return Response.json(await executarBaixaCentral(base44,user,b));
  } catch(error){return Response.json({error:error.message},{status:422});}
}