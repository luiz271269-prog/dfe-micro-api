import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function ExcecoesLoopRTable({ rows }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b p-4"><h2 className="font-bold">Exceções Loop-R</h2><p className="text-xs text-muted-foreground">Registros que exigem classificação, vínculo ou correção</p></div>
      {rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma exceção identificada.</p> : <div className="max-h-80 overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-muted"><tr>{['Data', 'Origem', 'Descrição', 'Categoria', 'Modalidade', 'Valor', 'Motivo', 'Status', 'Ação'].map((x) => <th key={x} className="whitespace-nowrap px-3 py-2 text-left text-xs">{x}</th>)}</tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={row.id} className="border-t"><td className="whitespace-nowrap px-3 py-2">{formatDate(row.date)}</td><td className="px-3 py-2">{row.source}</td><td className="max-w-48 truncate px-3 py-2">{row.description}</td><td className="px-3 py-2">{row.category}</td><td className="px-3 py-2">{row.mode}</td><td className="whitespace-nowrap px-3 py-2 font-semibold">{formatCurrency(row.value)}</td><td className="px-3 py-2 text-warning">{row.reason}</td><td className="px-3 py-2">{row.status}</td><td className="px-3 py-2"><Link className="font-semibold text-primary hover:underline" to={row.link}>Abrir</Link></td></tr>)}</tbody></table></div>}
    </section>
  );
}