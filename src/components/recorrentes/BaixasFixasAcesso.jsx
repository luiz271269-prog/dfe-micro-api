import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BaixasSelecao from '@/components/baixas/BaixasSelecao';
import BaixaAcaoRegistro from '@/components/baixas/BaixaAcaoRegistro';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function BaixasFixasAcesso({ inicio, fim, regra, onSaved, onRevisar }) {
  const [open, setOpen] = useState(false);
  const [ano, mes] = fim.split('-').map(Number);
  const filtro = { recorrente: true, data: { $gte: `${inicio}-01`, $lt: new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10) } };
  if (regra) {
    const marcador = `Regra recorrente ${regra.id} ·`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filtro.$or = [{ regra_recorrente_id: regra.id }, { $and: [{ $or: [{ regra_recorrente_id: { $exists: false } }, { regra_recorrente_id: null }, { regra_recorrente_id: '' }] }, { observacoes: { $regex: marcador } }] }];
  }
  const consulta = useInfiniteQuery({ queryKey: ['baixas-fixas-documentos', inicio, fim, regra?.id || null], enabled: open, initialPageParam: null, queryFn: ({ pageParam }) => base44.entities.DespesaOperacional.filter(filtro, { sort: '-data', limit: 30, cursor: pageParam || undefined }), getNextPageParam: p => p.has_more ? p.next_cursor : undefined });
  const documentos = consulta.data?.pages.flatMap(p => p.items) || [];
  async function atualizar() { await consulta.refetch(); await onSaved?.(); }
  return <>
    <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>Baixar / conciliar</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Baixa e conciliação · Despesas fixas</DialogTitle><DialogDescription>{regra?.nome || 'Despesas recorrentes registradas'} · {inicio} a {fim}</DialogDescription></DialogHeader>
      <p className="text-sm text-muted-foreground">Selecione o documento da ocorrência para abrir a mesma revisão financeira dos demais módulos. Uma previsão não pode ser baixada como pagamento.</p>
      {consulta.isPending ? <p role="status" className="py-6 text-muted-foreground">Carregando documentos do período...</p> : consulta.error ? <div role="alert" className="text-destructive"><p>{consulta.error.message}</p><Button variant="outline" onClick={() => consulta.refetch()}>Tentar novamente</Button></div> : <BaixasSelecao registros={documentos.map(d => ({ tipo: 'DespesaOperacional', id: d.id, descricao: `${d.descricao} · ${d.competencia || d.data}` }))} onSaved={atualizar}>
        <div className="space-y-2">{documentos.map(d => <article key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-semibold text-sm">{d.descricao}</p><p className="text-xs text-muted-foreground">{formatDate(d.data)} · {formatCurrency(d.valor)} · {d.empresa || 'Empresa não informada'}</p></div><BaixaAcaoRegistro entidade="DespesaOperacional" registroId={d.id} descricao={d.descricao} /></article>)}</div>
        {!documentos.length && <p className="py-6 text-sm text-muted-foreground">Nenhum documento de despesa fixa neste recorte. Analise as ocorrências para revisar evidências antes de confirmar um vínculo.</p>}
        {consulta.hasNextPage && <Button variant="outline" disabled={consulta.isFetchingNextPage} onClick={() => consulta.fetchNextPage()}>{consulta.isFetchingNextPage ? 'Carregando...' : 'Carregar mais documentos'}</Button>}
      </BaixasSelecao>}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-3"><Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>{onRevisar && <Button onClick={() => { setOpen(false); onRevisar(regra || null); }}>Revisar ocorrências e evidências</Button>}</div>
    </DialogContent></Dialog>
  </>;
}