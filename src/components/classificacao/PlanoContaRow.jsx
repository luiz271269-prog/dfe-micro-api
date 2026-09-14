import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import VinculosMultiSelect from '@/components/classificacao/VinculosMultiSelect';

export default function PlanoContaRow({ item, tipos, centros, onChange }) {
  const naturezas = item.naturezas_vinculadas?.length ? item.naturezas_vinculadas : item.natureza_vinculada ? [item.natureza_vinculada] : [];
  const codigo = item.rotulo.match(/^\d+(?:\.\d+)*/)?.[0] || '—';
  const alterar = dados => onChange(item.id, { ...item, ...dados });
  return <div className="grid grid-cols-1 gap-3 border-b px-4 py-3 last:border-0 lg:grid-cols-[80px_minmax(260px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_90px] lg:items-center">
    <span className="font-mono text-sm font-semibold text-primary">{codigo}</span>
    <div><Input value={item.rotulo} onChange={e => alterar({ rotulo: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Chave preservada: {item.chave}</p></div>
    <VinculosMultiSelect itens={tipos} value={naturezas} onChange={naturezas_vinculadas => alterar({ naturezas_vinculadas, natureza_vinculada: naturezas_vinculadas[0] || '' })} placeholder="Sem natureza" />
    <VinculosMultiSelect itens={centros} value={item.centros_custo_vinculados || []} onChange={centros_custo_vinculados => alterar({ centros_custo_vinculados })} placeholder="Todos os centros" />
    <label className="flex items-center gap-2 text-sm"><Switch checked={item.ativo} onCheckedChange={ativo => alterar({ ativo })} />Ativa</label>
  </div>;
}