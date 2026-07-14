import { AlertTriangle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export default function ExtratoValidationCard({ validation }) {
  if (!validation) return null;
  return (
    <div className={`mb-3 rounded-xl border p-3 ${validation.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        {validation.ok ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
        <p className="text-xs font-bold">{validation.ok ? 'Conferência diária aprovada' : 'Divergência na sequência de saldos'}</p>
      </div>
      {validation.future.length > 0 && <p className="text-xs text-amber-700 mb-2">{validation.future.length} lançamento(s) futuro(s) ignorado(s).</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead><tr className="text-muted-foreground"><th className="text-left py-1">Dia</th><th className="text-right">Entradas</th><th className="text-right">Saídas</th><th className="text-right">Líquido</th></tr></thead>
          <tbody>{validation.daily.map((day) => <tr key={day.data} className="border-t"><td className="py-1">{day.data}</td><td className="text-right text-emerald-700">{formatCurrency(day.entradas)}</td><td className="text-right text-red-700">{formatCurrency(day.saidas)}</td><td className="text-right font-semibold">{formatCurrency(day.liquido)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}