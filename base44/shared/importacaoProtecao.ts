const marcado=r=>!!r?.import_batch_id||r?.fonte_modulo==='vendas'&&!!r?.fonte_arquivo_hash;
const protegidos=new Set(['LancamentoBancario','LancamentoCartao','FaturaCartao','FolhaPagamento','DespesaOperacional','ObraReforma','ItemCompra','TituloCobranca','NotaFiscal']);
async function importados(db,tipo,ids){
  const found=new Set();for(let i=0;i<ids.length;i+=100){let cursor;do{const p=await db.RegistroImportacao.filter({entidade_tipo:tipo,entidade_id:{$in:ids.slice(i,i+100)}},{limit:500,...(cursor?{cursor}:{})});p.items.forEach(r=>found.add(r.entidade_id));cursor=p.has_more?p.next_cursor:null;}while(cursor);}
  return found;
}
function protegerDb(db){return new Proxy(db,{get(target,tipo){const api=target[tipo];if(!api||!protegidos.has(tipo))return api;return new Proxy(api,{get(a,op){
  if(['list','filter'].includes(op))return async(...args)=>{const idx=op==='filter'?1:0;if(args[idx]?.fields)args[idx]={...args[idx],fields:[...new Set([...args[idx].fields,'import_batch_id','fonte_modulo','fonte_arquivo_hash'])]};const result=await a[op](...args),items=Array.isArray(result)?result:result.items;if(!items?.length)return result;const blocked=await importados(db,tipo,items.map(r=>r.id));const safe=items.filter(r=>!marcado(r)&&!blocked.has(r.id));return Array.isArray(result)?safe:{...result,items:safe};};
  if(op==='get')return async id=>{const r=await a.get(id);if(marcado(r)||(await importados(db,tipo,[id])).size)throw new Error('Registro de importação exige autorização contextual.');return r;};
  if(['update','delete'].includes(op))return async(id,...args)=>{if(marcado(await a.get(id))||(await importados(db,tipo,[id])).size)throw new Error('Automação bloqueada: importação exige confirmação explícita.');return a[op](id,...args);};
  if(op==='bulkUpdate')return async rows=>{const blocked=await importados(db,tipo,rows.map(r=>r.id));const docs=await a.filter({id:{$in:rows.map(r=>r.id)}},{limit:500});if(blocked.size||docs.items.some(marcado))throw new Error('Automação não pode alterar registros importados.');return a.bulkUpdate(rows);};
  if(['updateMany','deleteMany'].includes(op))return async(query,...args)=>{const page=await a.filter(query,{limit:500});if(page.has_more)throw new Error('Separe a operação automática para proteger o histórico importado.');const blocked=await importados(db,tipo,page.items.map(r=>r.id));if(blocked.size||page.items.some(marcado))throw new Error('Alteração automática de importações bloqueada.');return a[op]({$and:[query,{import_batch_id:{$exists:false}},{fonte_modulo:{$ne:'vendas'}}]},...args);};
  return typeof a[op]==='function'?a[op].bind(a):a[op];
}});}});}
export function protegerClienteImportacao(base44){const entities=protegerDb(base44.asServiceRole.entities);const service=new Proxy(base44.asServiceRole,{get(t,p){return p==='entities'?entities:Reflect.get(t,p);}});return new Proxy(base44,{get(t,p){return p==='asServiceRole'?service:p==='entities'?protegerDb(base44.entities):Reflect.get(t,p);}});}
// Verificação isolada: nenhum banco de dados é consultado ou alterado.
export async function validarProtecaoImportacao(){
  let mutacoes=0;const rows=[{id:'importado',import_batch_id:'lote_teste'},{id:'legado'}];
  const api={filter:async()=>({items:rows,has_more:false}),list:async()=>rows,get:async id=>rows.find(r=>r.id===id),update:async()=>{mutacoes++;}};
  const db={LancamentoBancario:api,RegistroImportacao:{filter:async()=>({items:[],has_more:false})}};
  const cliente=protegerClienteImportacao({entities:db,asServiceRole:{entities:db}});
  const filtrado=await cliente.asServiceRole.entities.LancamentoBancario.list();let bloqueado=false;
  try{await cliente.asServiceRole.entities.LancamentoBancario.update('importado',{status_conciliacao:'conciliado'});}catch{bloqueado=true;}
  const legado=await cliente.entities.LancamentoBancario.get('legado');
  const success=filtrado.length===1&&filtrado[0].id==='legado'&&bloqueado&&legado.id==='legado'&&mutacoes===0;
  if(!success)throw new Error('Invariante de proteção de importação falhou.');
  return {success,importado_oculto_na_automacao:true,legado_preservado:true,alteracao_automatica_bloqueada:bloqueado,mutacoes:mutacoes};
}
export async function bloquearBaixaAutomaticaImportada(db,body){
  if(body.conciliado_por!=='auto'&&!body.internal_token)return;
  const consultas=[['LancamentoBancario',body.lancamento_bancario_id],[body.entidade_tipo,body.entidade_id]];
  for(const [tipo,id] of consultas)if(tipo&&id&&(marcado(await db[tipo].get(id))||await db.RegistroImportacao.count({entidade_tipo:tipo,entidade_id:id})))throw new Error('Importação aguardando autorização: nenhuma baixa automática permitida.');
}