import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
export default function FaturaComposicaoLista({ consulta }) {
  const r = consulta.data.pages[0].resumo;
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Documentos e lançamentos explicam a fatura; não são pagamentos bancários individuais.</p>
    <div className="grid grid-cols-2 gap-3 text-sm"><p>Lançamentos líquidos da composição<br/><b>{formatCurrency(r.composicao)}</b></p><p>Diferença para a fatura<br/><b className={Math.abs(r.diferenca_composicao) > 0.01 ? 'text-warning' : 'text-success'}>{formatCurrency(r.diferenca_composicao)}</b></p></div>
    {Math.abs(r.diferenca_composicao) > 0.01 && <p className="text-xs text-warning">Revisar importação, créditos, encargos ou saldo anterior. A diferença não foi corrigida automaticamente e não significa, sozinha, documento não identificado.</p>}
    <div className="max-h-72 overflow-auto space-y-2">{consulta.data.pages.flatMap(p => p.items).map(l => <article key={l.id} className="border rounded-md p-2 text-xs"><div className="flex gap-3 justify-between"><span>{formatDate(l.data)} · {l.descricao}</span><b className="whitespace-nowrap">{formatCurrency(l.valor)}</b></div><p className="text-muted-foreground mt-1">{l.situacao} · {l.natureza}</p></article>)}</div>
    {!r.linhas && <p className="text-sm text-muted-foreground">Nenhum lançamento disponível. A obrigação da fatura permanece registrada integralmente.</p>}
    {consulta.hasNextPage && <Button variant="outline" size="sm" disabled={consulta.isFetchingNextPage} onClick={() => consulta.fetchNextPage()}>{consulta.isFetchingNextPage ? 'Carregando...' : 'Carregar mais lançamentos'}</Button>}
  </div>;
}