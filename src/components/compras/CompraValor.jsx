import { formatCurrency } from '@/lib/formatters';

export default function CompraValor({ valor, moeda = 'BRL', valorOriginal, taxaCambio }) {
  return <div className="tabular-nums whitespace-nowrap">
    <div>{formatCurrency(valor)}</div>
    {moeda !== 'BRL' && valorOriginal != null && <div className="text-xs font-normal text-muted-foreground">
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(valorOriginal)}
      {taxaCambio > 0 && <span> · câmbio {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(taxaCambio)}</span>}
    </div>}
  </div>;
}