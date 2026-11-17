import { useState } from 'react';
import { Button } from '@/components/ui/button';
import RevisaoClassificacaoDialog from '@/components/cartoes/RevisaoClassificacaoDialog';
import RevisaoConferirButton from '@/components/cartoes/RevisaoConferirButton';
export default function RevisaoClassificacaoAcoes({ item, disabled, onSaved }) {
  const [modo, setModo] = useState(null);
  const aberto = !item.conferido;
  const classificacaoCompleta = !item.pendente && !item.pendente_categoria && item.atual.categorias.every(Boolean);
  return <div className="flex flex-wrap gap-1">
    <Button size="sm" variant="outline" disabled={disabled} onClick={() => setModo('classificar')}>Classificar</Button>
    {aberto && classificacaoCompleta && <RevisaoConferirButton item={item} modo="conferir" disabled={disabled} onSaved={onSaved} />}
    {item.conferido && <RevisaoConferirButton item={item} modo="reabrir" disabled={disabled} onSaved={onSaved} />}
    {aberto && item.sugestao && <Button size="sm" disabled={disabled} onClick={() => setModo('confirmar')}>Confirmar sugestão</Button>}
    {modo && <RevisaoClassificacaoDialog key={modo} item={item} modo={modo} onClose={() => setModo(null)} onSaved={onSaved} />}
  </div>;
}