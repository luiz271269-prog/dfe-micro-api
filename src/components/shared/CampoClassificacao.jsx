import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import useCadastroClassificacao from '@/hooks/useCadastroClassificacao';

export default function CampoClassificacao({ eixo, label, value, onChange, natureza }) {
  const { itens, opcoes } = useCadastroClassificacao(eixo, natureza);
  return (
    <div>
      <Label>{eixo === 'origem' ? 'Centro de custo' : eixo === 'tipo' ? 'Natureza econômica' : eixo === 'categoria' ? 'Plano de contas' : label}</Label>
      <Select value={opcoes[value] ? value : ''} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={value ? 'Pendente de cadastro' : '—'} /></SelectTrigger>
        <SelectContent>
          {itens.map(item => <SelectItem key={item.chave} value={item.chave} className={eixo === 'categoria' && natureza && (item.naturezas_vinculadas || [item.natureza_vinculada]).includes(natureza) ? 'font-semibold text-primary' : ''}>{item.rotulo}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}