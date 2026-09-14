import { useEffect, useState } from 'react';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getCor } from '@/lib/classificacaoUnificada';
import useCadastroClassificacao from '@/hooks/useCadastroClassificacao';
import TipoGastoSelector from '@/components/shared/TipoGastoSelector';

// Badge editável para os eixos unificados: eixo="origem" (Quem comprou) ou "tipo" (Tipo de compra)
export default function SeletorClassificacao({ eixo, entityName, record, field, onChange }) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(record?.[field] || '');
  const { itens, opcoes } = useCadastroClassificacao(eixo, record?.tipo_compra);
  useEffect(() => setValor(record?.[field] || ''), [record?.id, record?.[field]]);

  async function salvar(v) {
    setValor(v);
    setEditing(false);
    const { data } = await revisarTiposGasto({ action: 'salvar_eixo', entidade: entityName, id: record.id, campo: field, valor: v });
    const aplicado = data?.classificacao?.[field] ?? v;
    setValor(aplicado);
    if (onChange) onChange(record.id, field, aplicado);
    window.dispatchEvent(new Event('neuralfinRefresh'));
  }

  if (eixo === 'tipo') return <TipoGastoSelector entityName={entityName} record={record} onChange={onChange} />;

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Select value={valor || ''} onValueChange={salvar} open onOpenChange={(o) => { if (!o) setEditing(false); }}>
          <SelectTrigger className="h-6 text-[10px] px-1.5 w-[130px]"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {itens.map(item => <SelectItem key={item.chave} value={item.chave} className={eixo === 'categoria' && record?.tipo_compra && item.natureza_vinculada === record.tipo_compra ? 'font-semibold text-primary' : ''}>{item.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        onClick={() => setEditing(true)}
        title="Clique para classificar"
        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer hover:opacity-75 transition-opacity ${getCor(eixo, valor)}`}
      >
        {opcoes[valor] || (valor ? 'Pendente de cadastro' : '—')}
      </span>
    </span>
  );
}