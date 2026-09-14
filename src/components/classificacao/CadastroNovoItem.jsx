import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { slugify } from '@/lib/classificacaoUnificada';
import VinculosMultiSelect from '@/components/classificacao/VinculosMultiSelect';

export default function CadastroNovoItem({ eixo, tipos, centros, onSave }) {
  const [rotulo, setRotulo] = useState('');
  const [naturezas, setNaturezas] = useState([]);
  const [centrosSelecionados, setCentrosSelecionados] = useState([]);
  const [saving, setSaving] = useState(false);
  async function adicionar() {
    const chave = slugify(rotulo.trim());
    if (!chave) return;
    setSaving(true);
    await onSave({ eixo, chave, rotulo: rotulo.trim(), natureza_vinculada: naturezas[0] || '', naturezas_vinculadas: eixo === 'categoria' ? naturezas : [], centros_custo_vinculados: eixo === 'categoria' ? centrosSelecionados : [], nivel: 'base', ativo: true, perfis_permitidos: ['admin', 'user'], ordem: 999 });
    setRotulo(''); setNaturezas([]); setCentrosSelecionados([]); setSaving(false);
  }
  return <div className="space-y-2 rounded-lg border bg-card p-2">
    <Input value={rotulo} onChange={e => setRotulo(e.target.value)} placeholder={eixo === 'categoria' ? 'Nome da conta' : 'Nova classificação'} />
    {eixo === 'categoria' && <div className="grid grid-cols-2 gap-2"><VinculosMultiSelect itens={tipos} value={naturezas} onChange={setNaturezas} placeholder="Naturezas" /><VinculosMultiSelect itens={centros} value={centrosSelecionados} onChange={setCentrosSelecionados} placeholder="Centros de custo" /></div>}
    <Button className="w-full" onClick={adicionar} disabled={saving || !rotulo.trim()}><Plus />Adicionar</Button>
  </div>;
}