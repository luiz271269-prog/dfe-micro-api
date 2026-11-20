import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';

const centavosBRL = v => Number(String(v ?? '').replace(/[^\d-]/g, ''));

const horario = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
export default function AuditoriaRecebiveisRegistros({ tipo, versao }) {
  const lista = useInfiniteQuery({
    queryKey: ['auditoria-recebiveis-registros', tipo, versao],
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => base44.entities.ApontamentoRecebivel.filter({ ativo: true, grupo: tipo }, { limit: 15, sort: 'referencia', ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: p => p.has_more ? p.next_cursor : undefined,
  });
  if (lista.isPending) return <p className="p-3 text-xs text-muted-foreground">Carregando apontamentos…</p>;
  if (lista.isError && !lista.data) return <div role="alert" className="p-3 text-xs">Não foi possível carregar os apontamentos. <Button size="sm" variant="ghost" onClick={() => lista.refetch()}>Tentar novamente</Button></div>;
  return <div className="divide-y">
    {lista.data.pages.flatMap(p => p.items).map(a => <article key={a.id} className="space-y-2 p-3 text-xs">
      <h4 className="break-words text-sm font-semibold">{a.referencia}</h4>
      {(a.cliente || a.empresa) && <p className="text-muted-foreground">{[a.empresa, a.cliente].filter(Boolean).join(' · ')}</p>}
      <dl className="space-y-1.5 [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&_dt]:shrink-0 [&_dt]:text-muted-foreground [&_dd]:break-all [&_dd]:text-right">
        <div><dt>Total da nota</dt><dd>{a.registrado}</dd></div>
        <div><dt>Soma das parcelas</dt><dd>{a.comparado}</dd></div>
        <div><dt>Diferença</dt><dd className="font-semibold">{formatCurrency(Math.abs(centavosBRL(a.registrado) - centavosBRL(a.comparado)) / 100)}</dd></div>
        <div><dt>Detectado em</dt><dd>{horario.format(new Date(a.detectado_em))}</dd></div>
      </dl>
      <p className="rounded border-l-4 border-l-warning bg-warning/10 px-2 py-2 font-medium">{a.motivo}</p>
    </article>)}
    {lista.isFetchNextPageError && <p role="alert" className="p-2 text-xs text-destructive">Não foi possível carregar mais registros.</p>}
    {lista.hasNextPage && <div className="p-2"><Button size="sm" variant="outline" onClick={() => lista.fetchNextPage()} disabled={lista.isFetchingNextPage}>{lista.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}</Button></div>}
  </div>;
}