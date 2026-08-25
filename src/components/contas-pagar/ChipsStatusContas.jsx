import { AlertTriangle } from 'lucide-react';

const CHIPS = [
  { key: 'todos',    label: 'Todos' },
  { key: 'aberto',   label: 'Em Aberto' },
  { key: 'semana',   label: 'Vencendo esta semana', alerta: true },
  { key: 'vencidos', label: 'Vencidos', alerta: true },
  { key: 'pagos',    label: 'Pagos' },
];

export default function ChipsStatusContas({ status, onChange, contagens = {} }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {CHIPS.map(c => {
        const ativo = status === c.key;
        const qtd = contagens[c.key] ?? 0;
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
              ativo
                ? 'bg-primary text-primary-foreground border-primary'
                : c.alerta
                  ? 'bg-card text-red-600 border-red-200 hover:bg-red-50'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
            }`}
          >
            {c.alerta && !ativo && <AlertTriangle className="w-3 h-3" />}
            {c.label}
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${ativo ? 'bg-white/20' : 'bg-muted'}`}>{qtd}</span>
          </button>
        );
      })}
    </div>
  );
}