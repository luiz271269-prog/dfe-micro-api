import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { norm } from '../../shared/evidenciaFinanceira.ts';
const dataValida = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
export default async function(req) {
  try {
    const base44=createClientFromRequest(req), user=await base44.auth.me();
    if (!user) return Response.json({error:'Unauthorized'},{status:401});
    if (user.role!=='admin') return Response.json({error:'Forbidden'},{status:403});
    const body=await req.json(), db=base44.asServiceRole.entities;
    if(body.validate_only)return Response.json({success:true,fonte:'vendas',direcao:'entrada',pagamentos:'informados, aguardam conciliação'});
    const notas=body.notas || [], cobrancas=body.cobrancas || [], empresa=body.empresa || 'NeuralTec';
    if(!['NeuralTec','Liesch'].includes(empresa)||!Array.isArray(notas)||!Array.isArray(cobrancas)||notas.length>200||cobrancas.length>200||JSON.stringify(body).length>500000)return Response.json({error:'Lote inválido; máximo de 200 notas e 200 parcelas.'},{status:400});
    if ([...notas,...cobrancas].some(r => r.empresa && r.empresa !== empresa)) return Response.json({error:'O lote deve pertencer a uma única empresa.'},{status:400});
    const hash=String(body.arquivo_hash || '').slice(0,100), hoje=new Date().toISOString().slice(0,10);
    const chave=(tipo,numero)=>`vendas|${empresa}|${tipo}|${String(numero).trim()}`;
    const normalizadas=notas.map(n=>{
      if(!String(n.numero || '').trim()||!['NF','CI'].includes(n.tipo)||!n.cliente||!dataValida(n.data_emissao)||!Number.isFinite(n.valor_total)||n.valor_total<0)throw new Error('Nota sem identidade, data ou valor válido.');
      return {numero:String(n.numero).trim(),tipo:n.tipo,cliente:String(n.cliente).trim(),empresa,data_emissao:n.data_emissao,vendedor:['Tiago','Thais','Fat.Direto'].includes(n.vendedor)?n.vendedor:'Fat.Direto',valor_total:n.valor_total,fonte_modulo:'vendas',fonte_chave:chave(n.tipo,n.numero),fonte_arquivo_hash:hash,valor_recebido_informado:Number(n.valor_recebido || 0)};
    });
    let saved=0,created=0,updated=0;
    if(normalizadas.length){
      const pagina=await db.NotaFiscal.filter({numero:{$in:normalizadas.map(n=>n.numero)},$or:[{empresa}, {empresa:{$exists:false}}, {empresa:null}]},{limit:500});
      if(pagina.has_more)throw new Error('Muitas notas históricas para este lote. Separe o arquivo antes de importar.');
      const novos=[],alteracoes=[];
      for(const n of [...new Map(normalizadas.map(n=>[n.fonte_chave,n])).values()]){
        const iguais=pagina.items.filter(r=>r.numero===n.numero&&r.tipo===n.tipo);
        if(iguais.length>1)throw new Error(`Nota ${n.tipo}-${n.numero} possui duplicatas históricas. Revisão necessária, sem excluir registros.`);
        const existente=iguais[0];
        if(existente && norm(existente.cliente)!==norm(n.cliente))throw new Error(`Cliente divergente na nota ${n.numero}. Revisão necessária.`);
        if(existente){
          if(Math.abs(Number(existente.valor_total)-n.valor_total)>0.01)throw new Error(`Valor divergente na nota ${n.numero}. Histórico preservado para revisão.`);
          alteracoes.push({id:existente.id,fonte_modulo:n.fonte_modulo,fonte_chave:n.fonte_chave,fonte_arquivo_hash:hash,valor_recebido_informado:n.valor_recebido_informado});
        } else novos.push({...n,status:n.valor_total===0?'anulada':'a_vencer',valor_recebido:0,valor_aberto:n.valor_total});
      }
      if(novos.length)await db.NotaFiscal.bulkCreate(novos);
      if(alteracoes.length)await db.NotaFiscal.bulkUpdate(alteracoes);
      created+=novos.length;updated+=alteracoes.length;saved+=novos.length+alteracoes.length;
    }
    if(cobrancas.length){
      const refs=cobrancas.map(c=>{const m=String(c.seu_numero || '').match(/^(NF|CI)-([0-9]+)$/i);if(!m||!c.cliente||!c.parcela_numero||!dataValida(c.data_vencimento)||!Number.isFinite(c.valor_titulo)||c.valor_titulo<=0)throw new Error('Parcela sem referência oficial, número, vencimento ou valor válido.');return {c,tipo:m[1].toUpperCase(),numero:m[2]};});
      const pais=await db.NotaFiscal.filter({numero:{$in:refs.map(r=>r.numero)},$or:[{empresa},{empresa:{$exists:false}},{empresa:null}]},{limit:500});
      if(pais.has_more)throw new Error('Referências históricas excedem o lote. Revisão necessária.');
      const normalizados=refs.map(({c,tipo,numero})=>{
        const paisCandidatos=pais.items.filter(n=>n.numero===numero&&n.tipo===tipo&&norm(n.cliente)===norm(c.cliente));
        if(paisCandidatos.length!==1)throw new Error(`Parcela ${c.seu_numero}: nota de origem ausente ou ambígua. Importe a nota oficial antes.`);
        const nota=paisCandidatos[0];
        return {nosso_numero:String(c.nosso_numero || `${numero}/${c.parcela_numero}`),seu_numero:`${tipo}-${numero}`,cliente:String(c.cliente).trim(),empresa,data_vencimento:c.data_vencimento,valor_titulo:c.valor_titulo,canal_cobranca:String(c.canal_cobranca || 'sicredi'),nota_fiscal_id:nota.id,parcela_numero:Number(c.parcela_numero),parcela_total:Number(c.parcela_total || c.parcela_numero),fonte_modulo:'vendas',fonte_chave:`${chave(tipo,numero)}|p:${c.parcela_numero}`,fonte_arquivo_hash:hash,valor_pago_informado:Number(c.valor_pago || 0),...(dataValida(c.data_pagamento)?{data_pagamento_informada:c.data_pagamento}:{})};
      });
      const pagina=await db.TituloCobranca.filter({nota_fiscal_id:{$in:[...new Set(normalizados.map(c=>c.nota_fiscal_id))]}},{limit:500});
      const legado=await db.TituloCobranca.filter({seu_numero:{$in:[...new Set(normalizados.map(c=>c.seu_numero))]}},{limit:500});
      if(pagina.has_more||legado.has_more)throw new Error('Parcelas históricas excedem o lote. Revisão necessária.');
      const existentes=[...new Map([...pagina.items,...legado.items].map(r=>[r.id,r])).values()],novos=[],alteracoes=[];
      for(const c of [...new Map(normalizados.map(c=>[c.fonte_chave,c])).values()]){
        const iguais=existentes.filter(r=>(r.fonte_chave===c.fonte_chave)||(r.seu_numero===c.seu_numero&&norm(r.cliente)===norm(c.cliente)&&Number(r.parcela_numero)===c.parcela_numero&&(!r.empresa||r.empresa===empresa)));
        if(iguais.length>1)throw new Error(`Parcela ${c.seu_numero}/${c.parcela_numero} duplicada. Revisão necessária.`);
        if(iguais[0]){
          if(Math.abs(Number(iguais[0].valor_titulo)-c.valor_titulo)>0.01)throw new Error('Valor da parcela divergente. Histórico preservado.');
          alteracoes.push({id:iguais[0].id,nota_fiscal_id:c.nota_fiscal_id,fonte_modulo:'vendas',fonte_chave:c.fonte_chave,fonte_arquivo_hash:hash,valor_pago_informado:c.valor_pago_informado,...(c.data_pagamento_informada?{data_pagamento_informada:c.data_pagamento_informada}:{})});
        } else novos.push({...c,valor_pago:0,status:c.data_vencimento<hoje?'vencido':'em_aberto'});
      }
      if(novos.length)await db.TituloCobranca.bulkCreate(novos);
      if(alteracoes.length)await db.TituloCobranca.bulkUpdate(alteracoes);
      created+=novos.length;updated+=alteracoes.length;saved+=novos.length+alteracoes.length;
    }
    return Response.json({success:true,saved,created,updated});
  }catch(error){return Response.json({error:error.message},{status:422});}
}