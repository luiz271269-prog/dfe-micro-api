import { periodoPagamentoFolha } from '@/lib/folhaCalendario';
const formatar = data => data.split('-').reverse().join('/');
export default function PeriodoPagamentoFolha({ competencia }) {
  const periodo = periodoPagamentoFolha(competencia);
  if (!periodo) return null;
  return <div className="mb-4 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
    <p><strong>Folha mensal {competencia}</strong> · pagamento previsto de <strong>{formatar(periodo.inicio)}</strong> a <strong>{formatar(periodo.fim)}</strong> (5º–7º dia útil do mês seguinte).</p>
    <p className="text-xs text-muted-foreground mt-1">Conciliação com PIX do mês seguinte; competência permanece {competencia}, e o caixa usa a data efetiva do banco. Calendário bancário: seg–sex, feriados nacionais e bancários; feriados locais não incluídos. Férias e rescisão mantêm seus próprios prazos.</p>
  </div>;
}