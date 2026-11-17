import { formatCurrency, formatDate } from '@/lib/formatters';

export default function CartaoCabecalho({ registro: r, detalhe, local }) {
  const fatura = detalhe.relacionados?.find(x => x.tipo === 'FaturaCartao')?.registro;
  const central = !!r.raw.pedido_central_internal_id;
  const vinculo = central ? `Pedido ${r.raw.pedido_central_id} · parcela ${r.raw.pedido_central_parcela}/${r.raw.pedido_central_parcelas}` : local ? 'Documento local vinculado' : 'Sem vínculo';
  return <div className="border-b p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Transação do cartão selecionada</p>
    <h2 className="mt-1 font-semibold">{r.descricao}</h2>
    <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
      <div><p className="text-xs text-muted-foreground">Valor</p><b>{formatCurrency(r.total)}</b></div>
      <div><p className="text-xs text-muted-foreground">Data · fatura</p><b>{formatDate(r.data)}{fatura ? ` · ${fatura.mes_referencia}` : ''}</b></div>
      <div><p className="text-xs text-muted-foreground">Vínculo</p><b className={central || local ? 'text-success' : 'text-warning'}>{vinculo}</b></div>
    </div>
  </div>;
}