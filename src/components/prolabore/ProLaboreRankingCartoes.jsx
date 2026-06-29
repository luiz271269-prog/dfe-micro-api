import { CreditCard } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

export default function ProLaboreRankingCartoes({ ranking, totalCartao }) {
  return (
    <div className="bg-card rounded-xl border p-4 mb-2">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="w-4 h-4 text-orange-600" />
        <h3 className="text-sm font-bold">Gasto Pessoal por Cartão</h3>
        <span className="ml-auto text-sm font-bold text-orange-700">{formatCurrency(totalCartao)}</span>
      </div>
      <div className="space-y-2">
        {ranking.map(c => {
          const pct = totalCartao > 0 ? (c.valor / totalCartao) * 100 : 0;
          return (
            <div key={c.cartao}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium truncate">{c.cartao} <span className="text-muted-foreground">({c.lancamentos})</span></span>
                <span className="font-bold tabular-nums ml-2">{formatCurrency(c.valor)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}