import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function FrequenciaRecorrente({ form, onChange }) {
  const semanal = form.frequencia === 'semanal';
  return <>
    <div><Label>Frequência</Label><Select value={form.frequencia || 'mensal'} onValueChange={frequencia => onChange({ ...form, frequencia })}>
      <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="semanal">Semanal</SelectItem><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="trimestral">Trimestral</SelectItem><SelectItem value="anual">Anual</SelectItem>
      </SelectContent></Select></div>
    <div><Label>{semanal ? 'Data inicial' : 'Mês inicial'}</Label><Input type={semanal ? 'date' : 'month'} value={semanal ? form.data_inicio || '' : form.mes_inicio || ''} onChange={e => onChange(semanal ? { ...form, data_inicio: e.target.value } : { ...form, mes_inicio: e.target.value })} />
      <p className="text-[10px] text-muted-foreground">{semanal ? 'Define o dia da semana e inicia o ciclo de sete dias.' : 'Define quando a previsão começa, mesmo sem pagamentos.'}</p></div>
    <div className="sm:col-span-2"><Label>Conta do extrato</Label><Input value={form.conta_bancaria || ''} placeholder="Todas as contas" onChange={e => onChange({ ...form, conta_bancaria: e.target.value })} /></div>
  </>;
}