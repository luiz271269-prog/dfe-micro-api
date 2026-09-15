import { formatCurrency, formatDate } from '@/lib/formatters';

export default function HistoricoBaixasManuais({ registro }) {
  const pagamentos = [...(registro.pagamentos_manuais || [])].sort((a, b) => a.data.localeCompare(b.data));
  const anterior = Math.max(0, (registro.valor_pago || 0) - pagamentos.reduce((s, p) => s + p.valor, 0));
  return <div className="space-y-2 text-xs">
    <p className="font-semibold">Histórico de baixas manuais</p>
    {anterior > 0 && <p className="text-muted-foreground">Pago anteriormente ou por outros fluxos: {formatCurrency(anterior)}</p>}
    {!pagamentos.length && <p className="text-muted-foreground">Nenhuma baixa manual registrada neste histórico.</p>}
    <ul className="max-h-36 overflow-y-auto divide-y">{pagamentos.map(p => <li key={p.id} className="flex justify-between gap-3 py-2"><span>{formatDate(p.data)} · {p.forma.replaceAll('_', ' ')}</span><b>{formatCurrency(p.valor)}</b></li>)}</ul>
    <p className="text-muted-foreground">Baixa manual não cria movimentação bancária nem confirma conciliação com o extrato. Não registre novamente um pagamento já contabilizado.</p>
  </div>;
}