import { CreditCard, Landmark } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

function Coluna({ titulo, descricao, itens, destaque }) {
  const total = itens.reduce((s, item) => s + item.valor, 0);
  return <section className="rounded-xl border bg-card overflow-hidden">
    <header className={`p-4 border-b ${destaque ? 'bg-primary/10' : 'bg-muted/40'}`}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{titulo}</h2><p className="text-xs text-muted-foreground mt-0.5">{descricao}</p></div><p className="font-bold tabular-nums whitespace-nowrap">{formatCurrency(total)}</p></div>
      <p className="text-[11px] text-muted-foreground mt-2">{itens.length} lançamento{itens.length === 1 ? '' : 's'}</p>
    </header>
    <div className="divide-y max-h-[520px] overflow-y-auto">
      {itens.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma despesa no período.</p> : itens.map(item => <div key={item.key} className="p-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">{item.fonte === 'Cartão' ? <CreditCard className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}</div>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{item.descricao}</p><p className="text-[11px] text-muted-foreground truncate">{formatDate(item.data)} · {item.fonte} · {item.categoria || 'Sem categoria'}</p></div>
        <p className="text-sm font-bold tabular-nums whitespace-nowrap">{formatCurrency(item.valor)}</p>
      </div>)}
    </div>
  </section>;
}

export default function ColunasDespesas({ fixas, variaveis }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
    <Coluna titulo="Despesas fixas" descricao="Lançamentos identificados por regras recorrentes" itens={fixas} destaque />
    <Coluna titulo="Despesas variáveis" descricao="Demais despesas classificadas em cartões e extratos" itens={variaveis} />
  </div>;
}