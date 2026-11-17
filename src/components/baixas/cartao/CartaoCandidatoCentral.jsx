import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function CartaoCandidatoCentral({ c, selecionado, onSelect, children }) {
  const bloqueado = c.bloqueios.length > 0;
  return <article className={`space-y-2 rounded-lg border p-3 ${selecionado ? 'border-primary bg-primary/5' : 'bg-background'}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0"><h4 className="text-sm font-semibold">{c.numero} · {c.fornecedor}</h4><p className="truncate text-xs text-muted-foreground">{c.itens.join(' · ')}</p></div>
      <span className="whitespace-nowrap text-xs font-semibold text-primary">{c.pontos}/100</span>
    </div>
    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <div><dt className="text-muted-foreground">Total do pedido</dt><dd className="font-semibold">{formatCurrency(c.total)}</dd></div>
      <div><dt className="text-muted-foreground">Esta transação</dt><dd className="font-semibold">{c.opcao ? `Parcela ${c.parcela_sugerida}/${c.opcao.parcelas} · ${formatCurrency(c.opcao.esperado)}` : 'Valor não confere'}</dd></div>
      <div><dt className="text-muted-foreground">Pagamento na Central</dt><dd>{c.condicao || c.forma_rotulo}</dd></div>
      <div><dt className="text-muted-foreground">Data do pedido</dt><dd>{c.data ? formatDate(c.data) : 'Não informada'}</dd></div>
    </dl>
    <ul className="list-disc pl-4 text-xs text-muted-foreground">{c.razoes.map(x => <li key={x}>{x}</li>)}</ul>
    {c.alertas.length > 0 && <ul className="list-disc pl-4 text-xs text-warning">{c.alertas.map(x => <li key={x}>{x}</li>)}</ul>}
    {c.vinculadas > 0 && <p className="text-xs">Parcelas já vinculadas a outras transações: {c.parcelas_ocupadas.join(', ') || c.vinculadas}</p>}
    {c.ambiguo && <p className="text-xs font-semibold text-warning">Ambíguo: outro pedido tem pontuação próxima. Compare antes de vincular.</p>}
    {bloqueado && <p className="text-xs text-destructive">Bloqueado: {c.bloqueios.join(' ')}</p>}
    <Button type="button" size="sm" variant={selecionado ? 'default' : 'outline'} disabled={bloqueado} onClick={onSelect}>{selecionado ? 'Pedido selecionado' : 'Vincular a este pedido'}</Button>
    {children}
  </article>;
}