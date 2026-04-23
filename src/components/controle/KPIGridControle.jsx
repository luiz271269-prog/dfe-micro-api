import { Package, Store, ShoppingCart, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

export default function KPIGridControle({ kpis }) {
  const cards = [
    { label: 'Total de Compras', value: formatCurrency(kpis.totalCompras), sub: `${kpis.totalItens} itens`, icon: ShoppingCart, color: 'from-orange-500 to-amber-600' },
    { label: 'SKUs Virtuais', value: kpis.totalSKUs, sub: 'Produtos agrupados', icon: Package, color: 'from-indigo-500 to-purple-600' },
    { label: 'Fornecedores', value: kpis.totalFornecedores, sub: 'Ativos no histórico', icon: Store, color: 'from-blue-500 to-cyan-600' },
    { label: 'Conformidade 3-way', value: `${kpis.pctConformidade.toFixed(0)}%`, sub: 'Compras c/ pagamento', icon: CheckCircle2, color: 'from-emerald-500 to-teal-600' },
    { label: 'Anomalias de Preço', value: kpis.variacoesAltas, sub: 'Variação > 20%', icon: AlertTriangle, color: 'from-rose-500 to-red-600' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className="bg-card rounded-xl border overflow-hidden">
            <div className={`h-1 w-full bg-gradient-to-r ${c.color}`} />
            <div className="p-3">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{c.label}</p>
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className="text-lg font-bold tabular-nums">{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}