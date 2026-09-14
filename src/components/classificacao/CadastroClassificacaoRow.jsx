import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import VinculosMultiSelect from '@/components/classificacao/VinculosMultiSelect';

export default function CadastroClassificacaoRow({ item, tipos, centros, onSave, onRemove }) {
  const inicialNaturezas = item.naturezas_vinculadas?.length ? item.naturezas_vinculadas : item.natureza_vinculada ? [item.natureza_vinculada] : [];
  const [draft, setDraft] = useState({ ...item, naturezas_vinculadas: inicialNaturezas, centros_custo_vinculados: item.centros_custo_vinculados || [] });
  const [saving, setSaving] = useState(false);
  const perfis = draft.perfis_permitidos || [];
  const conta = item.eixo === 'categoria';
  const toggle = role => setDraft({ ...draft, perfis_permitidos: perfis.includes(role) ? perfis.filter(x => x !== role) : [...perfis, role] });
  async function salvar() { setSaving(true); await onSave({ ...draft, natureza_vinculada: draft.naturezas_vinculadas?.[0] || '' }, item.id); setSaving(false); }
  return <div className={conta ? 'grid grid-cols-1 2xl:grid-cols-[minmax(140px,1fr)_130px_130px_68px_56px_64px_76px] items-center gap-2 border-b p-2 last:border-0' : 'grid grid-cols-1 2xl:grid-cols-[minmax(120px,1fr)_68px_56px_64px_76px] items-center gap-2 border-b p-2 last:border-0'}>
    <div><Input value={draft.rotulo} onChange={e => setDraft({ ...draft, rotulo: e.target.value })} /><p className="mt-1 truncate text-xs text-muted-foreground">{draft.chave}</p></div>
    {conta && <><VinculosMultiSelect itens={tipos} value={draft.naturezas_vinculadas} onChange={naturezas_vinculadas => setDraft({ ...draft, naturezas_vinculadas })} placeholder="Todas" /><VinculosMultiSelect itens={centros} value={draft.centros_custo_vinculados} onChange={centros_custo_vinculados => setDraft({ ...draft, centros_custo_vinculados })} placeholder="Todos" /></>}
    <label className="flex items-center gap-1 text-xs"><Switch checked={draft.ativo} onCheckedChange={ativo => setDraft({ ...draft, ativo })} />Ativo</label>
    <label className="flex items-center gap-1 text-xs"><Checkbox checked={perfis.includes('admin')} onCheckedChange={() => toggle('admin')} />Admin</label>
    <label className="flex items-center gap-1 text-xs"><Checkbox checked={perfis.includes('user')} onCheckedChange={() => toggle('user')} />Usuário</label>
    <div className="flex gap-1"><Button size="icon" onClick={salvar} disabled={saving} title="Salvar"><Save /></Button><Button size="icon" variant="ghost" onClick={() => onRemove(item.id)} title="Excluir"><Trash2 /></Button></div>
  </div>;
}