import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
const ESTADOS={sem_indicacao:'Sem indicação de pagamento',aguardando_busca:'Pagamento ou movimento aguardando busca',pendente:'Pendente, sem candidato elegível',proposta:'Correspondência encontrada, aguardando autorização',ambiguo:'Ambíguo, escolha exige revisão',revisao:'Revisão manual necessária',executando:'Execução autorizada em processamento',concluido:'Execução concluída',falhou:'Execução falhou, confira auditoria antes de repetir',nao_aplicavel:'Sem liquidação nesta conferência'};
export default function RegistroImportacaoLinha({registro:r,onPropor,busy}){
  return <article className="rounded-xl border bg-card p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium text-sm">{r.descricao}</h3><span className="text-xs text-primary">{ESTADOS[r.estado]||r.estado}</span></div>
    <p className="mt-1 text-xs text-muted-foreground">{r.conferencia.replaceAll('_',' ')} · {r.resultado_importacao} · {r.empresa} · {r.entidade_tipo}</p>
    {r.pagamento_informado&&<p className="mt-2 text-xs">Fonte informa {formatCurrency(r.valor_pago_informado)} · {r.status_informado} · {r.data_pagamento_informada||'sem data'} · {r.forma_informada||'instrumento não informado'}. Não é baixa confirmada.</p>}
    {r.detalhe&&<p className="mt-2 text-xs text-muted-foreground">{r.detalhe}</p>}
    {(r.candidatos||[]).map(c=><div key={c.chave} className="mt-3 border-t pt-3 flex flex-wrap gap-3 justify-between items-center"><div className="text-xs"><p className="font-semibold">{c.descricao_documento} ↔ {c.descricao_movimento}</p><p>{formatCurrency(c.valor)} · {c.data} · {c.empresa} · {c.efeito==='composicao'?'Composição, sem baixa':'Financeira'}</p><p className="text-muted-foreground mt-1">{c.criterio}</p></div><Button size="sm" variant="outline" disabled={busy||!['proposta','ambiguo','revisao'].includes(r.estado)} onClick={()=>onPropor(c)}>Conferir e autorizar</Button></div>)}
    {r.erro&&<p role="alert" className="mt-2 text-xs text-destructive">{r.erro}</p>}{r.resultado_execucao?.mensagem&&<p className="mt-2 text-sm text-primary">{r.resultado_execucao.mensagem}</p>}
    {r.auditoria_id&&<p className="mt-2 text-xs text-muted-foreground">Proposta {r.id} · Pedido {r.pedido_id} · Auditoria {r.auditoria_id}</p>}
  </article>;
}