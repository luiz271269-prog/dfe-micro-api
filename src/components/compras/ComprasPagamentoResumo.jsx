import { ShoppingCart, TrendingDown } from 'lucide-react';
import { GradientCard } from '@/components/shared/GradientCard';
import { formatCurrency } from '@/lib/formatters';

const canais = [['banco_pix', 'PIX', 'orange'], ['cartao', 'Cartão', 'blue'], ['banco_boleto', 'Boletos a prazo', 'purple']];
export default function ComprasPagamentoResumo({ compras, filtro, onFilter }) {
  const total = compras.reduce((s, c) => s + (c.valor_total || 0), 0);
  const outras = compras.filter(c => !canais.some(([key]) => key === c.forma_pagamento));
  return <div className="mb-6">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {canais.map(([key, label, gradient]) => {
        const itens = compras.filter(c => c.forma_pagamento === key);
        return <GradientCard key={key} title={label} value={formatCurrency(itens.reduce((s, c) => s + (c.valor_total || 0), 0))} sub={`${itens.length} compras · pagas e a pagar`} icon={ShoppingCart} gradient={gradient} active={filtro === key} onClick={() => onFilter(filtro === key ? 'all' : key)} />;
      })}
      <GradientCard title="Total Compras" value={formatCurrency(total)} sub={`${compras.length} itens no período · CMV estimado`} icon={TrendingDown} gradient="red" onClick={() => onFilter('all')} />
    </div>
    {outras.length > 0 && <p className="text-xs text-muted-foreground mt-2">Incluído no total: {formatCurrency(outras.reduce((s, c) => s + (c.valor_total || 0), 0))} em dinheiro, transferência ou pagamento não informado.</p>}
  </div>;
}