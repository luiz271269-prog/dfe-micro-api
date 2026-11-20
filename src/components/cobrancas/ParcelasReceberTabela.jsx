import { LockKeyhole, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function ParcelasReceberTabela({ linhas, desabilitado, onChange, onRemove }) {
  return <div className="overflow-x-auto rounded-lg border">
    <table className="w-full min-w-[440px] text-sm">
      <thead className="bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-2">Parcela</th><th className="p-2">Vencimento</th><th className="p-2 text-right">Valor (R$)</th><th className="p-2">Situação</th></tr></thead>
      <tbody>{linhas.map((l, i) => <tr key={l.key} className="border-t">
        <th scope="row" className="p-2 text-left font-medium">{l.id ? (l.parcela_numero || '—') : 'Nova'}</th>
        <td className="p-2">{l.bloqueada ? formatDate(l.data_vencimento) : <Input className="h-8" aria-label={`Vencimento da linha ${i + 1}`} type="date" required disabled={desabilitado} value={l.data_vencimento} onChange={e => onChange(l.key, 'data_vencimento', e.target.value)} />}</td>
        <td className="p-2 text-right tabular-nums">{l.bloqueada ? formatCurrency(l.valor_titulo) : <Input className="h-8 text-right" aria-label={`Valor da linha ${i + 1}`} type="number" inputMode="decimal" min="0.01" step="0.01" required disabled={desabilitado} value={l.valor} onChange={e => onChange(l.key, 'valor', e.target.value)} />}</td>
        <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{l.bloqueada ? <span className="inline-flex items-center gap-1"><LockKeyhole className="size-3" />{l.status === 'pago' ? 'Paga' : 'Com pagamento ou vínculo'}</span> : l.id ? 'Em aberto' : <Button type="button" size="sm" variant="ghost" aria-label={`Remover nova linha ${i + 1}`} disabled={desabilitado} onClick={() => onRemove(l.key)}><X /></Button>}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}