import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { deslocarCompetencia, correspondeTributo, saldoTributo, empresaExtrato } from '../../shared/tributoRegras.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error:'Não autenticado' }, { status:401 });
    const body = await req.json();
    if (body.acao === 'validar_regras') {
      const guia={ tipo:'DAS', empresa:'NeuralTec', competencia:'2026-09', data_vencimento:'2026-10-20', valor_original:100, juros_multa:10, valor_pago:0, status:'a_vencer' };
      const lanc={ descricao:'DAS ref 09/2026', conta_bancaria:'NeuralTec 36092-2', data:'2026-10-20', valor:-110, categoria:'tributo' };
      const checks={ competencia_anterior:deslocarCompetencia('2026-01')==='2025-12', baixa_com_encargos:correspondeTributo(lanc,guia), bloqueia_empresa:!correspondeTributo({...lanc,conta_bancaria:'Liesch 37101-4'},guia), bloqueia_competencia:!correspondeTributo({...lanc,descricao:'DAS ref 08/2026'},guia), bloqueia_outro_imposto:!correspondeTributo({...lanc,descricao:'FGTS'},guia), saldo_parcial:saldoTributo({...guia,valor_pago:40})===70, conta_desconhecida:empresaExtrato({...lanc,conta_bancaria:'Conta desconhecida'})===null, competencia_preservada:guia.competencia==='2026-09' };
      return Response.json({ success:Object.values(checks).every(Boolean), checks, sem_escritas:true });
    }
    const competencia = body.competencia;
    const pagamento = deslocarCompetencia(competencia,1);
    if (body.empresa && !['NeuralTec','Liesch'].includes(body.empresa)) return Response.json({error:'Empresa inválida'}, {status:400});
    const db=base44.entities;
    const empresas=body.empresa ? [body.empresa] : ['NeuralTec','Liesch'];
    const [guias, folhas, vendas] = await Promise.all([
      db.Tributo.aggregate({query:{competencia,empresa:{$in:empresas},tipo:{$in:['DAS','FGTS','INSS','GPS']}},groupBy:['empresa','tipo'],sum:['valor_original','valor_pago'],limit:20}),
      db.FolhaPagamento.aggregate({query:{competencia,empresa:{$in:empresas}},groupBy:['empresa','funcionario_id','funcionario_nome','tipo'],sum:['fgts_valor','desconto_inss'],limit:1000}),
      db.NotaFiscal.aggregate({query:{empresa:{$in:empresas},data_emissao:{$gte:`${competencia}-01`,$lt:`${pagamento}-01`},status:{$ne:'anulada'},is_espelho_ci:{$ne:true}},groupBy:'empresa',sum:'valor_total',limit:2})
    ]);
    if (guias.truncated || folhas.truncated || vendas.truncated) throw new Error('Apuração incompleta: volume excede o limite seguro.');
    const itens=empresas.flatMap(empresa=>['DAS','FGTS','INSS'].map(tipo=>{
      const grupos=guias.rows.filter(r=>r.empresa===empresa && (r.tipo===tipo || tipo==='INSS' && r.tipo==='GPS'));
      const folha=folhas.rows.filter(r=>r.empresa===empresa);
      const duplicadas=folha.some(r=>r.count>1 || !r.funcionario_id);
      const referencia=tipo==='DAS' ? vendas.rows.find(r=>r.empresa===empresa)?.sum_valor_total || 0 : folha.reduce((s,r)=>s+(tipo==='FGTS' ? r.sum_fgts_valor || 0 : r.sum_desconto_inss || 0),0);
      return { empresa,tipo,competencia,mes_pagamento:pagamento,guias:grupos.reduce((s,r)=>s+r.count,0),referencia:Math.round(referencia*100)/100,folhas:folha.reduce((s,r)=>s+r.count,0),valor_sugerido:tipo==='FGTS' && !duplicadas && referencia>0 ? Math.round(referencia*100)/100 : null, aviso:tipo==='DAS' ? 'Faturamento da competência. Informar o DAS apurado conforme regime, faixa e regras fiscais; não aplicar alíquota fixa.' : tipo==='INSS' ? 'Retenções registradas na folha. Não são necessariamente o total da guia: conferir contribuições patronais, compensações e DARF previdenciário.' : duplicadas ? 'Conferir identidade e duplicidades da folha antes de utilizar os valores.' : 'FGTS registrado nos cálculos da folha. Conferir a guia antes do cadastro; não copiar o mês anterior.' };
    }));
    return Response.json({success:true,competencia,itens,sem_escritas:true});
  } catch(error) { return Response.json({error:error.message}, {status:400}); }
}