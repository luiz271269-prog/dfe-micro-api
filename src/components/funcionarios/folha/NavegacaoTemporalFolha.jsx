import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '../../../lib/formatters';
import { rotuloMesCurto } from '../../../lib/folhaDashboardEngine';

export default function NavegacaoTemporalFolha({ resumos, competencia, onChange }) {
  return (
    <div className="bg-card border rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" /> Navegação Temporal
        </p>
        <Input type="month" value={competencia} onChange={e => e.target.value && onChange(e.target.value)} className="h-7 text-xs w-36" />
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
        {resumos.map(r => {
          const ativo = r.competencia === competencia;
          return (
            <button key={r.competencia} onClick={() => onChange(r.competencia)}
              className={`rounded-lg px-2 py-1.5 text-center transition-all border ${
                ativo ? 'bg-primary text-primary-foreground border-primary shadow' : 'bg-sidebar text-sidebar-foreground border-transparent hover:opacity-90'
              }`}>
              <p className="text-[10px] font-bold capitalize leading-tight">{rotuloMesCurto(r.competencia)}</p>
              <p className={`text-[10px] ${ativo ? 'opacity-90' : 'opacity-70'}`}>{r.qtd}</p>
              <p className="text-[10px] font-semibold tabular-nums">{formatCurrency(r.liquido, true)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}