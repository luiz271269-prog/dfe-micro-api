import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import JornadaTrabalhoFields from '@/components/funcionarios/JornadaTrabalhoFields';
export default function VinculoJornadaFields({ value, onChange, disabled = false }) {
  return <div className="space-y-4">
    <div><Label>Data de fichamento (auxiliar)</Label><Input type="date" value={value.data_fichamento || ''} onChange={e => onChange({ ...value, data_fichamento: e.target.value })} disabled={disabled} /><p className="text-xs text-muted-foreground mt-1">Registro formal separado da admissão; não muda o início permitido para folha, férias e outros eventos.</p></div>
    <JornadaTrabalhoFields value={value} onChange={onChange} disabled={disabled} />
  </div>;
}