import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DeleteAccountDialog({ collapsed }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const me = await base44.auth.me();
      await base44.entities.User.delete(me.id);
      base44.auth.logout();
    } catch {
      setError('Não foi possível excluir automaticamente. Entre em contato com o administrador do sistema para concluir a exclusão da sua conta.');
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setConfirmText(''); setError(null); }}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-red-400 transition-colors w-full no-select">
          <Trash2 className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Excluir conta</span>}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir conta permanentemente</DialogTitle>
          <DialogDescription>
            Esta ação é <strong>permanente e irreversível</strong>. Seu acesso ao aplicativo será removido.
            Para confirmar, digite <strong>EXCLUIR</strong> abaixo.
          </DialogDescription>
        </DialogHeader>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="EXCLUIR" autoComplete="off" />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" disabled={confirmText !== 'EXCLUIR' || loading} onClick={handleDelete} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Excluir conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}