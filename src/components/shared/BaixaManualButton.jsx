import { useState } from 'react';
import { Button } from '@/components/ui/button';
import BaixasDialog from '@/components/baixas/BaixasDialog';

export default function BaixaManualButton({ entidade, registroId, registros, descricao, onSaved, children = 'Baixar / conciliar', className = '', abaInicial = 'dados' }) {
  const [revisao, setRevisao] = useState(null);
  const referencias = registros || [{ tipo: entidade, id: registroId, descricao }];
  return <>
    <Button type="button" size="sm" variant="outline" disabled={!referencias.length || referencias.some(r => !r.id)} className={className} onClick={e => { e.stopPropagation(); setRevisao(referencias); }}>{children}</Button>
    {revisao && <BaixasDialog registros={revisao} abaInicial={abaInicial} onClose={() => setRevisao(null)} onSaved={onSaved} />}
  </>;
}