import { Building2 } from 'lucide-react';
import { formatCurrency } from '../../../lib/formatters';

export default function FolhaPorDepartamento({ porSetor, setorConfig }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
        <Building2 className="w-3.5 h-3.5" /> Por Departamento
      </p>
      {porSetor.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">Sem folhas nesta competência</p>
      ) : (
        <div className="space-y-2">
          {porSetor.map(s => {
            const cfg = setorConfig[s.setor] || { label: s.setor, color: 'bg-slate-100 text-slate-700 border-slate-200' };
            return (
              <div key={s.setor} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                <div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${cfg.color}`}>{cfg.label}</span>
                  <p className="text-[10px] text-muted-foreground mt-1">{s.qtd} funcionário{s.qtd !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">{formatCurrency(s.total)}</p>
                  <p className="text-[10px] text-muted-foreground">Média: {formatCurrency(s.media)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}