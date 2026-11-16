import { useState } from 'react';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import { Button } from '@/components/ui/button';

const ROTULOS = { conferir: ['Marcar conferida', 'Marcando...'], reabrir: ['Reabrir', 'Reabrindo...'] };

export default function RevisaoConferirButton({ item, modo, disabled, onSaved }) {
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  async function executar() {
    setSaving(true); setError('');
    try {
      const { data } = await revisarTiposGasto({ action: 'conferir_grupo_revisao', modo, grupo: { fatura_id: item.fatura_id, estabelecimento: item.estabelecimento, origem_compra: item.atual.origem_compra, tipo_compra: item.atual.tipo_compra, quantidade: item.quantidade } });
      if (!data.success) throw new Error(data.error || 'Não foi possível registrar a conferência.');
      await onSaved(data, modo);
    } catch (e) { setError(e.response?.data?.error || e.message); } finally { setSaving(false); }
  }
  return <>
    <Button size="sm" variant="outline" disabled={disabled || saving} onClick={executar}>{ROTULOS[modo][saving ? 1 : 0]}</Button>
    {error && <p role="alert" className="basis-full text-xs text-destructive">{error}</p>}
  </>;
}