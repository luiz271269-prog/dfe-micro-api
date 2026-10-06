import { useState } from 'react';
import { Button } from '@/components/ui/button';
import RevisaoClassificacaoDialog from '@/components/cartoes/RevisaoClassificacaoDialog';
export default function RevisaoClassificacaoAcoes({ item, disabled, onSaved }) {
  const [modo, setModo] = useState(null);
  return <div className="flex flex-wrap gap-1">
    <Button size="sm" variant="outline" disabled={disabled} onClick={() => setModo('classificar')}>Classificar</Button>
    {item.sugestao && <Button size="sm" disabled={disabled} onClick={() => setModo('confirmar')}>Confirmar sugestão</Button>}
    {modo && <RevisaoClassificacaoDialog key={modo} item={item} modo={modo} onClose={() => setModo(null)} onSaved={onSaved} />}
  </div>;
}