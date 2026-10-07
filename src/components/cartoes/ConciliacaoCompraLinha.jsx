import { formatCurrency, formatDate } from '@/lib/formatters';
import ConciliacaoCompraCandidato from '@/components/cartoes/ConciliacaoCompraCandidato';
const estados={automatico:'Alta confiança',revisao:'Revisão necessária',vinculado:'Documento vinculado',conflito:'Conflito entre documentos',sem_correspondencia:'Sem correspondência segura'};
export default function ConciliacaoCompraLinha({row,busy,onConfirm}) {
  return <details className="border rounded-lg p-3">
    <summary className="cursor-pointer flex gap-3 flex-wrap text-sm"><span className="font-medium flex-1">{row.descricao}</span><span>{formatDate(row.data)}</span><strong>{formatCurrency(row.valor)}</strong><span className="text-xs text-primary">{estados[row.status]}</span></summary>
    <div className="mt-3 space-y-3">
      <p className="text-xs text-muted-foreground">Compra: {row.empresa||'Empresa pendente'} · classificação salva: {row.origem_compra||'Pendente'} / {row.tipo_compra||'Pendente'} · referência {row.id}</p>
      {row.vinculos.map(v=><p className="text-xs" key={v}>Documento: {v} · {row.auditado?'Com trilha de conciliação':'Vínculo legado; trilha ainda não certificada'}</p>)}
      {row.status==='conflito'&&<p className="text-sm text-destructive">A mesma compra possui mais de um documento. Correção manual necessária; nenhum vínculo foi apagado.</p>}
      {row.candidatos.map(c=><ConciliacaoCompraCandidato key={`${c.tipo}-${c.id}`} row={row} candidato={c} busy={busy} onConfirm={onConfirm}/>)}
      {row.status==='sem_correspondencia'&&<p className="text-xs text-muted-foreground">Não há documento livre de igual valor, sem conflito e com data próxima. Parcelas, pagamentos já registrados e diferenças de valor exigem análise no módulo de origem.</p>}
    </div>
  </details>;
}