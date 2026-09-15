import { useState } from 'react';
import { Button } from '@/components/ui/button';
import PagamentoManualDialog from '@/components/shared/PagamentoManualDialog';

export default function BaixaManualButton({ entidade, registroId, onSaved, children = 'Pagamento / histórico', className = '' }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" size="sm" variant="outline" className={className} onClick={e => { e.stopPropagation(); setOpen(true); }}>{children}</Button>
    {open && <PagamentoManualDialog entidade={entidade} registroId={registroId} onClose={() => setOpen(false)} onSaved={onSaved} />}
  </>;
}