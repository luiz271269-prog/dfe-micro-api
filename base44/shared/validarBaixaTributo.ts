import { baixarTributo } from './tributoBaixa.ts';
export async function validarBaixaTributo() {
  const tabelas={Tributo:[{id:'guia',tipo:'DAS',empresa:'NeuralTec',competencia:'2026-09',data_vencimento:'2026-10-20',valor_original:100,juros_multa:10,valor_pago:0,status:'a_vencer'}],LancamentoBancario:[{id:'b1',descricao:'DAS ref 09/2026',conta_bancaria:'NeuralTec 36092-2',data:'2026-10-20',valor:-70,categoria:'tributo'},{id:'b2',descricao:'DAS ref 09/2026',conta_bancaria:'NeuralTec 36092-2',data:'2026-10-21',valor:-40,categoria:'tributo'}],VinculoExtrato:[],SugestaoConciliacao:[],AuditoriaConciliacao:[]};
  const clone=v=>JSON.parse(JSON.stringify(v));
  function corresponde(r,q={}) {
    return Object.entries(q).every(([k,v])=>{
      if(k==='$and')return v.every(x=>corresponde(r,x));
      if(k==='$or')return v.some(x=>corresponde(r,x));
      if(v&&typeof v==='object')return Object.entries(v).every(([op,valor])=>op==='$exists'?(r[k]!==undefined)===valor:op==='$lt'?r[k]<valor:op==='$in'?valor.includes(r[k]):op==='$nin'?!valor.includes(r[k]):false);
      return r[k]===v;
    });
  }
  const db={};
  for(const [nome,rows] of Object.entries(tabelas))db[nome]={
    async get(id){const r=rows.find(x=>x.id===id);if(!r)throw new Error('Registro inexistente');return clone(r);},
    async filter(q){return {items:clone(rows.filter(r=>corresponde(r,q))),has_more:false};},
    async create(data){const r={...clone(data),id:crypto.randomUUID()};rows.push(r);return clone(r);},
    async update(id,data){Object.assign(rows.find(r=>r.id===id),clone(data));},
    async updateMany(q,change){for(const r of rows.filter(x=>corresponde(x,q))){Object.assign(r,change.$set||{});for(const k of Object.keys(change.$unset||{}))delete r[k];}},
    async delete(id){rows.splice(rows.findIndex(r=>r.id===id),1);}
  };
  const body={acao:'criar',entidade_id:'guia',lancamento_bancario_id:'b1',valor_alocado:70};
  const primeira=await baixarTributo(db,body);
  const repetida=await baixarTributo(db,body);
  const checks={parcial_preserva_saldo:primeira.obrigacao.soma===70&&primeira.obrigacao.status!=='pago',repeticao_sem_duplicar:repetida.idempotente&&tabelas.VinculoExtrato.length===1};
  const completa=await baixarTributo(db,{...body,lancamento_bancario_id:'b2',valor_alocado:40});
  checks.quita_com_encargos=completa.obrigacao.status==='pago'&&tabelas.Tributo[0].valor_pago===110;
  checks.multiplos_pagamentos_sem_fk_falso=tabelas.Tributo[0].lancamento_bancario_id===null;
  checks.data_ultimo_pagamento=tabelas.Tributo[0].data_pagamento==='2026-10-21';
  const removida=await baixarTributo(db,{acao:'remover',vinculo_id:primeira.vinculo.id});
  checks.reabre_somente_saldo_restante=removida.obrigacao.soma===40&&removida.obrigacao.status!=='pago';
  checks.competencia_integra=tabelas.Tributo[0].competencia==='2026-09';
  checks.libera_reservas=!tabelas.Tributo[0].conciliacao_token&&tabelas.LancamentoBancario.every(r=>!r.conciliacao_token);
  checks.preservacao_auditoria=tabelas.AuditoriaConciliacao.some(r=>r.acao==='vinculo_preparado')&&tabelas.AuditoriaConciliacao.some(r=>r.acao==='vinculo_removido');
  return {success:Object.values(checks).every(Boolean),checks,sem_escritas_reais:true};
}