import { ShoppingCart, TrendingDown } from 'lucide-react';
import { GradientCard } from '@/components/shared/GradientCard';
import { formatCurrency } from '@/lib/formatters';

const CANAIS = [
  { chave: 'pix', label: 'PIX', gradient: 'orange', formas: ['pix', 'banco_pix'] },
  { chave: 'cartao', label: 'Cartão', gradient: 'blue', formas: ['cartao', 'debito_automatico'] },
  { chave: 'boleto', label: 'Boletos a prazo', gradient: 'purple', formas: ['boleto', 'banco_boleto'] },
];

// Espelha os cartões de Compras & Despesas: quanto está a pagar por instrumento.
export default function ResumoPorInstrumento({ itens = [] }) {
  const total = itens.reduce((s, i) => s + (i.valor || 0), 0);
  const conhecidas = CANAIS.flatMap(c => c.formas);
  const outros = itens.filter(i => !conhecidas.includes(i.forma_pagamento));

  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CANAIS.map(({ chave, label, gradient, formas }) => {
          const grupo = itens.filter(i => formas.includes(i.forma_pagamento));
          return (
            <GradientCard
              key={chave}
              title={label}
              value={formatCurrency(grupo.reduce((s, i) => s + (i.valor || 0), 0))}
              sub={`${grupo.length} títulos`}
              icon={ShoppingCart}
              gradient={gradient}
            />
          );
        })}
        <GradientCard
          title="Total a pagar"
          value={formatCurrency(total)}
          sub={`${itens.length} obrigações`}
          icon={TrendingDown}
          gradient="red"
        />
      </div>
      {outros.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          Incluído no total: {formatCurrency(outros.reduce((s, i) => s + (i.valor || 0), 0))} com pagamento não informado ou por outros meios.
        </p>
      )}
    </div>
  );
}