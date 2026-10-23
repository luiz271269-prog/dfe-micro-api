import { formatCurrency, formatDate } from '@/lib/formatters';
export default function FaturaPagamentoResumo({ resumo: r }) {
  const divergencia = r.comprovado_banco !== null && Math.abs(r.pago_registrado - r.comprovado_banco) > 0.01;
  return <div className="space-y-3 text-sm">
    <p className="text-muted-foreground">Somente os pagamentos da fatura reduzem esta obrigação. Não há rateio nem propagação de baixa para as compras.</p>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><p>Total da fatura<br/><b>{formatCurrency(r.total)}</b></p><p>Pago registrado<br/><b>{formatCurrency(r.pago_registrado)}</b></p><p>Saldo da fatura<br/><b>{formatCurrency(r.saldo)}</b></p><p>Situação<br/><b>{r.situacao}</b></p></div>
    <p className="text-xs text-muted-foreground">Vencimento: {formatDate(r.vencimento)} · Situação de pagamento independente da conferência da composição.</p>
    {r.comprovado_banco !== null && <p>Comprovado por vínculos bancários: <b>{formatCurrency(r.comprovado_banco)}</b></p>}
    {divergencia && <p role="status" className="text-xs text-warning">Há diferença entre o pagamento registrado e os vínculos bancários. Pode existir declaração ou informação histórica sem conciliação. Nenhum valor foi substituído.</p>}
    <p className="text-xs text-muted-foreground">Use a revisão financeira da fatura para declarar ou conciliar pagamentos e consultar o histórico.</p>
  </div>;
}