import { contratoImportacao, sanitizarImportacao, informacaoPagamento } from './importacaoContrato.ts';
import { normalizarEvidencia, norm } from './evidenciaFinanceira.ts';
import { criarFolhaValidada } from './folhaRegras.ts';
const chaves={FolhaPagamento:['funcionario_nome','competencia','tipo','empresa'],DespesaOperacional:['data','descricao','valor','empresa'],ObraReforma:['data','responsavel','descricao','valor'],ItemCompra:['fornecedor','numero_nota','descricao_produto','empresa'],FaturaCartao:['conta_cartao_id','mes_referencia'],LancamentoCartao:['fatura_id','data_lancamento','estabelecimento','valor'],LancamentoBancario:['data','valor','descricao','conta_bancaria','detalhe'],RelatorioFaturamento:['mes','fonte']};
export async function registrarOrigem(db,batch,r,tipo,documento,resultado,extra={}) {
  const m=contratoImportacao(batch.batch_type),info=informacaoPagamento(r,m);
  const descricao=String(r.funcionario_nome||r.cliente||r.fornecedor||r.responsavel||r.estabelecimento||r.descricao||r.numero||r.mes||r.mes_referencia||tipo).slice(0,300);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([batch.id,tipo,documento?.id||null,r])));
  const chave=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
  const prev=await db.RegistroImportacao.filter({chave},{limit:1});if(prev.items.length)return prev.items[0];
  return db.RegistroImportacao.create({import_batch_id:batch.id,tipo_importacao:m.tipo,chave,entidade_tipo:tipo,entidade_id:documento?.id||'',descricao,empresa:r.empresa||'',valor:Number(r.valor_total??r.valor_titulo??r.salario_liquido??r.total??r.valor??0),data_referencia:r.data_vencimento||r.data_emissao||r.data||r.data_lancamento||`${r.competencia||r.mes||r.mes_referencia||''}-01`,...info,resultado_importacao:resultado,conferencia:m.conciliacao==='nenhuma'?'nao_aplicavel':'pendente',estado:info.pagamento_informado||['extrato_bancario','fatura_cartao','boletos_liquidados'].includes(m.tipo)?'aguardando_busca':m.conciliacao==='nenhuma'?'sem_indicacao':'nao_aplicavel',...Object.fromEntries(Object.entries(extra).filter(([,v])=>v!==undefined))});
}
export async function persistirRegistro(base44,batch,r,b) {
  const db=base44.entities,m=contratoImportacao(batch.batch_type);
  r={...r,empresa:r.empresa||b.empresa};
  if(m.evidencia){
    const p=normalizarEvidencia(m.tipo,r,{nome:batch.file_name,hash:batch.file_hash});
    p.chave=`${r.empresa}|${p.chave}`;
    const ex=await db.EvidenciaFinanceira.filter({chave:p.chave},{limit:2});
    if(ex.items.length>1)throw new Error('Evidência duplicada; histórico preservado para revisão.');
    const doc=ex.items[0]||await db.EvidenciaFinanceira.create(p);
    return registrarOrigem(db,batch,{...r,valor:p.valor},'EvidenciaFinanceira',doc,ex.items.length?'ignorado':'criado');
  }
  const tipo=m.tipo==='fatura_cartao'&&r.__type==='LancamentoCartao'?'LancamentoCartao':m.entity;
  const p=sanitizarImportacao(tipo,r);
  if(tipo!=='RelatorioFaturamento')p.import_batch_id=batch.id;
  if(['ItemCompra','DespesaOperacional','FolhaPagamento'].includes(tipo)&&!p.empresa)p.empresa=b.empresa;
  if(tipo==='FolhaPagamento')p.tipo=p.tipo||'mensal';
  if(tipo==='LancamentoCartao'){
    const fats=await db.FaturaCartao.filter({conta_cartao_id:b.conta_cartao_id,mes_referencia:b.mes_referencia},{limit:2});
    if(fats.items.length!==1)throw new Error('Fatura ausente ou ambígua. Salve o cabeçalho primeiro.');
    p.fatura_id=fats.items[0].id;
    if(!p.natureza)p.natureza='pessoal';
  }
  if(tipo==='FaturaCartao'&&!p.conta_cartao_id)throw new Error('Selecione explicitamente o cartão da fatura.');
  if(tipo==='LancamentoBancario'){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.data||'')||p.data>new Date().toISOString().slice(0,10)||!Number.isFinite(p.valor)||!p.valor||!p.conta_bancaria||/agendad|proje[cç][aã]o|saldo anterior|a vencer/i.test(p.descricao||''))throw new Error('Somente movimentos contabilizados, identificados e não futuros são permitidos.');
  }
  const query=Object.fromEntries(chaves[tipo].filter(k=>p[k]!==undefined&&p[k]!=='').map(k=>[k,p[k]]));
  if(!Object.keys(query).length)throw new Error('Documento sem identidade para deduplicação.');
  const ex=await db[tipo].filter(query,{limit:2});
  if(ex.items.length>1)return registrarOrigem(db,batch,r,tipo,null,'ignorado',{estado:'revisao',conferencia:'ambiguo',detalhe:'Registros existentes ambíguos; nenhuma alteração aplicada.'});
  const existente=ex.items[0];
  let doc=existente;
  if(!doc){
    if(tipo==='FolhaPagamento')doc=await criarFolhaValidada(db,p);
    else { const criados=await db[tipo].bulkCreate([p]);doc=criados[0];if(!doc?.id)throw new Error('Persistência não retornou o documento.'); }
  }
  return registrarOrigem(db,batch,r,tipo,doc,existente?'ignorado':'criado');
}
export async function persistirVendas(base44,batch,registros,b) {
  const refs=[];
  for(const entidade of ['NotaFiscal','TituloCobranca'])for(const empresa of ['NeuralTec','Liesch']){
    const rows=registros.filter(r=>r.__type===entidade&&(r.empresa||b.empresa)===empresa);if(!rows.length)continue;
    const res=await base44.functions.invoke('importarFonteVendas',{[entidade==='NotaFiscal'?'notas':'cobrancas']:rows,empresa,arquivo_hash:batch.file_hash});
    if(!res.data?.success)throw new Error(res.data?.error||'Fonte de vendas não importada.');
    for(const row of rows){
      const query=entidade==='NotaFiscal'?{empresa,tipo:row.tipo,numero:String(row.numero)}:{empresa,seu_numero:row.seu_numero,parcela_numero:row.parcela_numero,cliente:row.cliente};
      const found=await base44.entities[entidade].filter(query,{limit:2});
      if(found.items.length!==1)throw new Error('Registro da fonte ausente ou ambíguo após persistência.');
      const resultado=(res.data.registros_resultado||[]).find(r=>r.tipo===entidade&&r.id===found.items[0].id)?.resultado||'atualizado';
      refs.push(await registrarOrigem(base44.entities,batch,{...row,empresa},entidade,found.items[0],resultado,{estado:entidade==='NotaFiscal'?'sem_indicacao':undefined}));
    }
  }
  return refs;
}