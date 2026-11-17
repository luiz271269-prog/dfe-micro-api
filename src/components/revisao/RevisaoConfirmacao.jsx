import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Mostra o efeito previsto antes de qualquer gravação.
export default function RevisaoConfirmacao({ pedido, ocupado, erro, onCancelar, onConfirmar }) {
  if (!pedido) return null;
  const { item, proc, alternativa } = pedido;
  const efeitos = proc.efeitos.map(e => ({ ...e, depois: e.depois ?? alternativa }));
  return (
    <Dialog open onOpenChange={o => !o && onCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{proc.rotulo}</DialogTitle>
          <DialogDescription>{item.titulo} · {item.registro.descricao}</DialogDescription>
        </DialogHeader>
        {proc.tipo === 'abrir' ? (
          <p className="text-sm text-muted-foreground">Nada será alterado aqui. Você será levado ao módulo para seguir o fluxo autorizado.</p>
        ) : efeitos.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Campo</th><th>Antes</th><th>Depois</th></tr></thead>
            <tbody>{efeitos.map(e => <tr key={e.campo} className="border-t"><td className="py-2 font-medium">{e.campo}</td><td className="text-muted-foreground">{String(e.antes)}</td><td className="font-semibold text-primary">{String(e.depois)}</td></tr>)}</tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum dado será alterado. A decisão fica registrada com sua autoria{alternativa ? `: "${alternativa}"` : ''}.</p>
        )}
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onCancelar} disabled={ocupado}>Cancelar</Button>
          <Button onClick={onConfirmar} disabled={ocupado}>{ocupado ? 'Aplicando…' : proc.tipo === 'abrir' ? 'Ir ao módulo' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}