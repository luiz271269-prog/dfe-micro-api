import BaixasDialog from '@/components/baixas/BaixasDialog';

export default function PagamentoManualDialog({ entidade, registroId, onClose, onSaved }) {
  return <BaixasDialog registros={[{ tipo: entidade, id: registroId }]} abaInicial="pagar" onClose={onClose} onSaved={onSaved} />;
}