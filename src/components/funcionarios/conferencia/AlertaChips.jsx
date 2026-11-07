import { ALERTAS } from './rotulosConferencia';

export default function AlertaChips({ alertas = [], info = [] }) {
  if (!alertas.length && !info.length) return <span className="text-[11px] text-success font-medium">Sem divergência</span>;
  return <div className="flex flex-wrap gap-1">
    {alertas.map(a => <span key={a} className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">{ALERTAS[a] || a}</span>)}
    {info.map(a => <span key={a} className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-foreground">{ALERTAS[a] || a}</span>)}
  </div>;
}