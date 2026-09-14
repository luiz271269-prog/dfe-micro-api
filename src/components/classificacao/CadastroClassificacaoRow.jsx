import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

export default function CadastroClassificacaoRow({ item, tipos, onSave, onRemove }) {
  const [draft, setDraft] = useState(item);
  const [saving, setSaving] = useState(false);
  const perfis = draft.perfis_permitidos || [];
  const toggle = role => setDraft({ ...draft, perfis_permitidos: perfis.includes(role) ? perfis.filter(x => x !== role) : [...perfis, role] });
  async function salvar() { setSaving(true); await onSave(draft, item.id); setSaving(false); }
  return <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_80px_90px_90px_96px] items-center gap-3 border-b p-3 last:border-0">
    <div><Input value={draft.rotulo} onChange={e => setDraft({ ...draft, rotulo: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">{draft.chave}</p></div>
    {item.eixo === 'categoria' ? <select value={draft.natureza_vinculada || ''} onChange={e => setDraft({ ...draft, natureza_vinculada: e.target.value, nivel: e.target.value ? 'subcategoria' : 'base' })} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="">Compartilhada</option>{tipos.map(t => <option key={t.chave} value={t.chave}>{t.rotulo}</option>)}</select> : <span className="text-sm text-muted-foreground">Eixo principal</span>}
    <label className="flex items-center gap-2 text-sm"><Switch checked={draft.ativo} onCheckedChange={ativo => setDraft({ ...draft, ativo })} />Ativo</label>
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={perfis.includes('admin')} onCheckedChange={() => toggle('admin')} />Admin</label>
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={perfis.includes('user')} onCheckedChange={() => toggle('user')} />Usuário</label>
    <div className="flex gap-1"><Button size="icon" onClick={salvar} disabled={saving} title="Salvar"><Save /></Button><Button size="icon" variant="ghost" onClick={() => onRemove(item.id)} title="Excluir"><Trash2 /></Button></div>
  </div>;
}