import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import FolhaEventosPanel from './FolhaEventosPanel';

// Versão em janela do painel de eventos — usada em telas pequenas (no desktop o painel fica em coluna ao lado da folha).
export default function FolhaEventosDialog({ folha, folhas = [], funcionario = null, onClose, onSaved }) {
  return (
    <Dialog open={!!folha} onOpenChange={o => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogTitle className="sr-only">Eventos Detalhados da Folha</DialogTitle>
        <FolhaEventosPanel folha={folha} folhas={folhas} funcionario={funcionario} onClose={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}