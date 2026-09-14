import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { slugify } from '@/lib/classificacaoUnificada';

export default function CadastroNovoItem({ eixo, tipos, onSave }) {
  const [rotulo, setRotulo] = useState('');
  const [natureza, setNatureza] = useState('');
  const [saving, setSaving] = useState(false);
  async function adicionar() {
    const chave = slugify(rotulo.trim());
    if (!chave) return;
    setSaving(true);
    await onSave({ eixo, chave, rotulo: rotulo.trim(), natureza_vinculada: eixo === 'categoria' ? natureza : '', nivel: eixo === 'categoria' && natureza ? 'subcategoria' : 'base', ativo: true, perfis_permitidos: ['admin', 'user'], ordem: 999 });
    setRotulo(''); setNatureza(''); setSaving(false);
  }
  return <div className="flex flex-col sm:flex-row gap-2 rounded-xl border bg-card p-3">
    <Input value={rotulo} onChange={e => setRotulo(e.target.value)} placeholder="Nome da nova classificação" />
    {eixo === 'categoria' && <select value={natureza} onChange={e => setNatureza(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
      <option value="">Categoria-base compartilhada</option>
      {tipos.map(t => <option key={t.chave} value={t.chave}>{t.rotulo}</option>)}
    </select>}
    <Button onClick={adicionar} disabled={saving || !rotulo.trim()}><Plus />Adicionar</Button>
  </div>;
}