import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { gerenciarFuncionario } from '@/functions/gerenciarFuncionario';
import { Button } from '@/components/ui/button';
import { erroFolha } from '@/components/funcionarios/folha/folhaOperacoes';
import DuplicataFuncionarioDialog from '@/components/funcionarios/DuplicataFuncionarioDialog';
export default function ExcluirFuncionarioDuplicadoButton({ func, onDeleted }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false), [revisao, setRevisao] = useState(null), [manterId, setManterId] = useState('');
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [erro, setErro] = useState('');
  if (user?.role !== 'admin') return null;
  async function revisar(mais = false) {
    if (loading || saving) return;
    if (!mais) { setOpen(true); setRevisao(null); setManterId(''); }
    setLoading(true); setErro('');
    try {
      const res = await gerenciarFuncionario({ action: 'revisar_duplicata', id: func.id, ...(mais ? { cursor: revisao.next_cursor } : {}) });
      setRevisao(prev => mais ? { ...res.data, candidatos: [...prev.candidatos, ...res.data.candidatos] } : res.data);
    } catch (err) { setErro(erroFolha(err)); }
    finally { setLoading(false); }
  }
  async function excluir() {
    if (saving || !manterId) return;
    setSaving(true); setErro('');
    try {
      await gerenciarFuncionario({ action: 'excluir_duplicata', id: func.id, manter_id: manterId });
      setOpen(false); await onDeleted?.();
    } catch (err) { setErro(erroFolha(err)); }
    finally { setSaving(false); }
  }
  return <>
    <Button variant="outline" size="sm" className="text-destructive gap-1.5" onClick={() => revisar()}><Trash2 className="w-4 h-4" />Excluir cadastro duplicado</Button>
    <DuplicataFuncionarioDialog open={open} onClose={() => setOpen(false)} revisao={revisao} manterId={manterId} onSelect={setManterId} loading={loading} saving={saving} erro={erro} onConfirm={excluir} onMore={() => revisar(true)} />
  </>;
}