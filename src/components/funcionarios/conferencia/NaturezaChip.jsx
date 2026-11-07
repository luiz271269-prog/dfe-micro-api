import { NATUREZAS } from './rotulosConferencia';

export default function NaturezaChip({ natureza, children }) {
  const n = NATUREZAS[natureza];
  if (!n) return null;
  return <span title={n.hint} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${n.cls}`}>{n.label}{children}</span>;
}