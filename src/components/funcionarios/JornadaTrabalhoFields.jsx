import { Input } from '@/components/ui/input';
import { DIAS_JORNADA, resumoJornada, formatarHoras } from '@/lib/jornadaTrabalho';
import JornadaDiaFields from '@/components/funcionarios/JornadaDiaFields';
export default function JornadaTrabalhoFields({ value, onChange, disabled = false }) {
  const resumo = resumoJornada(value);
  function alterarDia(chave, patch) {
    const dias = DIAS_JORNADA.map(([dia]) => ({ dia, ativo: false, intervalo_minutos: 0, ...(value.jornada_trabalho || []).find(d => d.dia === dia), ...(dia === chave ? patch : {}) }));
    onChange({ ...value, jornada_trabalho: dias });
  }
  return <section className="space-y-3">
    <h4 className="text-sm font-semibold">Horário de trabalho</h4>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-xs text-muted-foreground">Referência diária (h)<Input type="number" min="0.25" max="24" step="0.25" required value={value.jornada_referencia_diaria ?? 8} onChange={e => onChange({ ...value, jornada_referencia_diaria: e.target.value })} disabled={disabled} /></label>
      <label className="text-xs text-muted-foreground">Referência semanal (h)<Input type="number" min="0.25" max="168" step="0.25" required value={value.jornada_referencia_semanal ?? 44} onChange={e => onChange({ ...value, jornada_referencia_semanal: e.target.value })} disabled={disabled} /></label>
    </div>
    <div className="space-y-2">{DIAS_JORNADA.map(([dia, label]) => <JornadaDiaFields key={dia} label={label} dia={(value.jornada_trabalho || []).find(d => d.dia === dia) || { dia, ativo: false }} referencia={resumo.referenciaDiaria} onChange={patch => alterarDia(dia, patch)} disabled={disabled} />)}</div>
    {!resumo.dias.length ? <p className="text-xs text-muted-foreground">Selecione os dias e informe os horários para calcular a jornada.</p> : resumo.erro ? <p className="text-xs text-destructive">Complete os horários para calcular a semana.</p> : <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
      <p>Total semanal: <strong>{formatarHoras(resumo.total)}</strong> · média por dia trabalhado: <strong>{formatarHoras(Math.round(resumo.total / resumo.dias.length))}</strong></p>
      {resumo.reducaoSemanal > 0 && <p>Jornada reduzida: <strong>{formatarHoras(resumo.reducaoSemanal)}</strong> a menos por semana ({(resumo.reducaoSemanal / (resumo.referenciaSemanal * 60) * 100).toFixed(1)}%).</p>}
    </div>}
    <p className="text-xs text-muted-foreground">Horas líquidas = saída − entrada − intervalo. Referências iniciais de 8h/dia e 44h/semana são ajustáveis; a comparação não altera salário nem banco de horas.</p>
  </section>;
}