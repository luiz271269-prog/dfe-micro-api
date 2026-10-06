import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Trash2 } from 'lucide-react';

export default function CalculoManualSeparado({ value = [], onChange, disabled = false }) {
  const numero = v => Number(v) || 0;
  const total = r => Math.round((numero(r.base) * numero(r.quantidade) + numero(r.acrescimos) - numero(r.descontos)) * 100) / 100;
  const alterar = (i, k, v) => onChange(value.map((r, index) => index === i ? { ...r, [k]: v } : r));
  return <section className="rounded-lg border bg-muted/30 p-3 space-y-3">
    <div><h3 className="text-sm font-semibold">Cálculo manual separado</h3><p className="text-xs text-muted-foreground">Simulação: base × quantidade + acréscimos − descontos; não altera documento, folha oficial, pagamentos ou fluxo de caixa.</p></div>
    <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Descrição','Base (R$)','Quantidade','Acréscimos','Descontos','Total simulado',''].map((s,i) => <th key={i} className="p-1 text-left">{s}</th>)}</tr></thead><tbody>
      {value.map((r,i) => <tr key={i}>
        <td className="p-1"><Input aria-label={`Descrição ${i+1}`} disabled={disabled} maxLength={120} value={r.descricao || ''} onChange={e => alterar(i,'descricao',e.target.value)} className="min-w-32" /></td>
        {['base','quantidade','acrescimos','descontos'].map(k => <td key={k} className="p-1"><Input aria-label={`${k} ${i+1}`} disabled={disabled} className="min-w-24" type="number" step="0.01" min="0" max="100000000" value={r[k] ?? ''} onChange={e => alterar(i,k,e.target.value)} /></td>)}
        <td className="p-1 whitespace-nowrap font-semibold">{formatCurrency(total(r))}</td>
        <td><Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label="Excluir linha de simulação" onClick={() => onChange(value.filter((_,index) => index !== i))}><Trash2 /></Button></td>
      </tr>)}
      {!value.length && <tr><td colSpan={7} className="py-3 text-muted-foreground">Nenhum ajuste simulado.</td></tr>}
    </tbody></table></div>
    <div className="flex justify-between items-center gap-3"><Button type="button" size="sm" variant="outline" disabled={disabled || value.length >= 30} onClick={() => onChange([...value, { descricao:'', base:'', quantidade:1, acrescimos:0, descontos:0 }])}><Plus /> Adicionar cálculo</Button><b className="text-sm">Total simulado: {formatCurrency(value.reduce((s,r) => s + total(r), 0))}</b></div>
  </section>;
}