import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

// REGRA BRT: qualquer data ISO (YYYY-MM-DD) é exibida como DD/MM/AAAA
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const display = (v) => (typeof v === 'string' && ISO_DATE.test(v)) ? formatDate(v) : v;

// Tela de auditoria: lista os registros exatos que compõem um totalizador do dashboard.
export default function DrilldownDialog({ drill, onClose }) {
  if (!drill) return null;
  const { title, subtitle, columns, rows, total, link } = drill;

  return (
    <Dialog open={!!drill} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span>{title}</span>
            {link && (
              <Link to={link} onClick={onClose}
                className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline shrink-0">
                Abrir página <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {subtitle ? `${subtitle} · ` : ''}{rows.length} registro{rows.length !== 1 ? 's' : ''}
          </p>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhum registro compõe este totalizador no período selecionado.</p>
        ) : (
          <div className="overflow-auto flex-1 border rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="border-b text-xs">
                  {columns.map((c) => (
                    <th key={c.label} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id || i} className="border-b last:border-0 hover:bg-muted/20">
                    {columns.map((c) => {
                      const v = c.get(row);
                      const isMoney = v && typeof v === 'object' && v.money;
                      return (
                        <td key={c.label} className={`px-3 py-2 ${isMoney ? 'text-right tabular-nums font-medium whitespace-nowrap' : ''} ${isMoney && v.value < 0 ? 'text-rose-600' : ''}`}>
                          {isMoney ? formatCurrency(v.value || 0) : (display(v) ?? '—')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total != null && rows.length > 0 && (
          <div className="flex justify-between items-center border-t pt-3 text-sm">
            <span className="font-semibold text-muted-foreground">Total ({rows.length} registros)</span>
            <span className={`font-bold text-base tabular-nums ${total < 0 ? 'text-rose-600' : 'text-foreground'}`}>{formatCurrency(total)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}