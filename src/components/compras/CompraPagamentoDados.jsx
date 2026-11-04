import { FORMAS_COMPRA } from '@/components/compras/CompraPagamentoFields';
import { formatCurrency } from '@/lib/formatters';

export default function CompraPagamentoDados({ documento }) {
  const final = String(documento.cartao_final || '').replace(/\D/g, '').slice(-4);
  return <div className="space-y-1 text-xs">
    <p>{documento.condicao_pagamento || FORMAS_COMPRA[documento.forma_pagamento] || 'Não informada'}</p>
    {documento.forma_pagamento === 'cartao' && <p className="text-muted-foreground">{final ? `Cartão final ${final}` : 'Final do cartão não informado na OC'}</p>}
    {documento.pagamento_antecipado && <p className="text-muted-foreground">Antecipado informado na OC</p>}
    {documento.valor_pago_informado > 0 && <p className="text-muted-foreground">Pago na OC: {formatCurrency(documento.valor_pago_informado)}</p>}
  </div>;
}