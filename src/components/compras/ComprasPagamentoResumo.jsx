import { ShoppingCart, TrendingDown } from 'lucide-react';
import { GradientCard } from '@/components/shared/GradientCard';
import { formatCurrency } from '@/lib/formatters';

const canais = [['banco_pix', 'PIX', 'orange'], ['cartao', 'Cartão', 'blue'], ['banco_boleto', 'Boletos a prazo', 'purple']];
export default function ComprasPagamentoResumo({ compras, resumoOnline, filtro, onFilter }) {
  const total = compras.reduce((s, c) => s + (c.valor || 0), 0) + (resumoOnline?.total || 0);
  const outras = compras.filter(c => !canais.some(([key]) => key === c.forma_pagamento));
  const valorOutras = outras.reduce((s, c) => s + (c.valor || 0), 0) + (resumoOnline?.outros || 0);
  const carregando = !resumoOnline || resumoOnline.loading;
  const indisponivel = Boolean(resumoOnline?.erro);
  const valorExibido = valor => carregando ? 'Carregando...' : indisponivel ? 'Indisponível' : formatCurrency(valor);
  const detalheExibido = texto => carregando ? 'Consultando ordens de compra' : indisponivel ? 'Atualize a consulta das ordens abaixo' : texto;
  return <div className="mb-6" aria-busy={Boolean(carregando)}>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {canais.map(([key, label, gradient]) => {
        const titulos = compras.filter(c => c.forma_pagamento === key);
        const online = resumoOnline?.canais?.[key];
        return <GradientCard key={key} title={label} value={valorExibido(titulos.reduce((s, c) => s + (c.valor || 0), 0) + (online?.valor || 0))} sub={detalheExibido(`${titulos.length + (online?.quantidade || 0)} títulos em aberto`)} icon={ShoppingCart} gradient={gradient} active={filtro === key} onClick={() => onFilter(filtro === key ? 'all' : key)} />;
      })}
      <GradientCard title="Total a pagar" value={valorExibido(total)} sub={detalheExibido(`${compras.length + (resumoOnline?.quantidade || 0)} notas e parcelas`)} icon={TrendingDown} gradient="red" onClick={() => onFilter('all')} />
    </div>
    {!carregando && !indisponivel && valorOutras > 0 && <p className="text-xs text-muted-foreground mt-2">Incluído no total: {formatCurrency(valorOutras)} com pagamento não informado ou por outros meios.</p>}
  </div>;
}