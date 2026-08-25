import { CalendarClock, CheckCircle2 } from 'lucide-react';

const OPCOES = [
  { key: 'aberto', label: 'Aberto (por vencimento)', icon: CalendarClock },
  { key: 'pagos',  label: 'Pagos (por emissão)',     icon: CheckCircle2 },
];

export default function ModoContasToggle({ modo, onChange }) {
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5">
      {OPCOES.map(o => {
        const Icon = o.icon;
        const ativo = modo === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              ativo ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {o.label}
          </button>
        );
      })}
    </div>
  );
}