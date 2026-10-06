import { Input } from '@/components/ui/input';
import { calcularJornadaDia, formatarHoras } from '@/lib/jornadaTrabalho';
export default function JornadaDiaFields({ dia, label, referencia, onChange, disabled }) {
  const calculo = calcularJornadaDia(dia);
  const reducao = dia.ativo && !calculo.erro ? Math.max(0, referencia * 60 - calculo.minutos) : 0;
  return <div className="rounded-lg border p-2 space-y-2">
    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!dia.ativo} disabled={disabled} onChange={e => onChange({ ativo: e.target.checked })} />{label}<span className="ml-auto text-xs text-muted-foreground">{dia.ativo ? (calculo.erro ? 'Pendente' : formatarHoras(calculo.minutos)) : 'Folga'}</span></label>
    {dia.ativo && <>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted-foreground">Entrada<Input aria-label={`Entrada ${label}`} type="time" required value={dia.entrada || ''} onChange={e => onChange({ entrada: e.target.value })} disabled={disabled} /></label>
        <label className="text-xs text-muted-foreground">Saída<Input aria-label={`Saída ${label}`} type="time" required value={dia.saida || ''} onChange={e => onChange({ saida: e.target.value })} disabled={disabled} /></label>
        <label className="text-xs text-muted-foreground">Intervalo (min)<Input aria-label={`Intervalo ${label}`} type="number" min="0" step="1" value={dia.intervalo_minutos ?? 0} onChange={e => onChange({ intervalo_minutos: e.target.value })} disabled={disabled} /></label>
      </div>
      {calculo.erro ? <p className="text-xs text-destructive">{calculo.erro}</p> : reducao > 0 && <p className="text-xs text-muted-foreground">Redução diária: {formatarHoras(reducao)} ({(reducao / (referencia * 60) * 100).toFixed(1)}%)</p>}
    </>}
  </div>;
}