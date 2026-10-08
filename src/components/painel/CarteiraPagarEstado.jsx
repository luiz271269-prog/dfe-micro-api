import { formatCurrency } from '@/lib/formatters';

export default function CarteiraPagarEstado({ consulta }) {
  const { data, isLoading, isFetching, error } = consulta;
  if (isLoading) return <p className="py-6 text-sm text-muted-foreground" role="status">Consultando as contas cadastradas…</p>;
  if (error) return <p className="py-3 text-sm text-destructive" role="alert">Não foi possível consultar Contas a Pagar: {error.response?.data?.error || error.message}</p>;
  if (!data) return null;
  return <div className="space-y-2 text-sm">
    {isFetching && <p className="text-xs text-muted-foreground" role="status">Atualizando saldos…</p>}
    <div className="flex justify-between gap-3"><span>Saldo confirmado em aberto</span><strong className="tabular-nums">{formatCurrency(data.totalConfirmado)}</strong></div>
    <div className="flex justify-between gap-3 text-muted-foreground"><span>Previsões não confirmadas</span><strong className="tabular-nums">{formatCurrency(data.totalPrevisto)}</strong></div>
    <p className="text-xs text-muted-foreground">Saldos atuais até {data.fim.split('-').reverse().join('/')} e contas sem vencimento; não é saída de caixa nem reconstrução histórica.</p>
    {data.semCalendario > 0 && <p className="text-xs text-destructive">{data.semCalendario} despesa(s) fixa(s) com calendário incompleto, não incluída(s) nas previsões.</p>}
  </div>;
}