import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function FrequenciaRecorrente({ form, onChange }) {
  return <>
    <div><Label>Frequência</Label><Select value={form.frequencia || 'mensal'} onValueChange={frequencia => onChange({ ...form, frequencia })}>
      <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="mensal">Mensal</SelectItem><SelectItem value="trimestral">Trimestral</SelectItem><SelectItem value="anual">Anual</SelectItem>
      </SelectContent></Select></div>
    <div><Label>Mês inicial</Label><Input type="month" value={form.mes_inicio || ''} onChange={e => onChange({ ...form, mes_inicio: e.target.value })} />
      <p className="text-[10px] text-muted-foreground">Define os meses previstos; obrigatório para trimestral e anual.</p></div>
    <div className="col-span-2"><Label>Conta do extrato</Label><Input value={form.conta_bancaria || ''} placeholder="Todas as contas" onChange={e => onChange({ ...form, conta_bancaria: e.target.value })} /></div>
  </>;
}