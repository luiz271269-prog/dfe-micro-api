import { useState } from 'react';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import RevisaoClassificacaoFields from '@/components/cartoes/RevisaoClassificacaoFields';
export default function RevisaoClassificacaoDialog({ item, modo, onClose, onSaved }) {
  const [value, setValue] = useState(modo === 'confirmar' ? { ...item.sugestao } : { origem_compra: item.atual.origem_compra, tipo_compra: item.atual.tipo_compra, categoria: item.atual.categorias.length === 1 ? item.atual.categorias[0] : '' });
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  async function salvar() {
    setSaving(true); setError('');
    try {
      const { data } = await revisarTiposGasto({ action: 'salvar_grupo_revisao', modo, grupo: { fatura_id: item.fatura_id, estabelecimento: item.estabelecimento, origem_compra: item.atual.origem_compra, tipo_compra: item.atual.tipo_compra, quantidade: item.quantidade }, classificacao: value });
      if (!data.success && !data.salvos) throw new Error(data.error || 'Não foi possível salvar a classificação.');
      await onSaved(data, modo); onClose();
    } catch (e) { setError(e.response?.data?.error || e.message); } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent onEscapeKeyDown={e => { if (saving) e.preventDefault(); }} onPointerDownOutside={e => { if (saving) e.preventDefault(); }}>
    <DialogHeader><DialogTitle>{modo === 'confirmar' ? 'Confirmar sugestão' : 'Classificar compras'}</DialogTitle><DialogDescription>{item.estabelecimento} · {item.cartao}. Aplica aos {item.quantidade} lançamentos deste grupo, somente nesta fatura; não altera meses anteriores.</DialogDescription></DialogHeader>
    <RevisaoClassificacaoFields value={value} onChange={setValue} disabled={saving || modo === 'confirmar'} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button disabled={saving || !value.origem_compra || !value.tipo_compra || !value.categoria} onClick={salvar}>{saving ? 'Salvando...' : modo === 'confirmar' ? 'Confirmar e salvar' : 'Salvar classificação'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}