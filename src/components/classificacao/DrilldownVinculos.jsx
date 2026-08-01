import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DrilldownVinculos({ open, onOpenChange, titulo, itens }) {
  const total = (itens || []).reduce((s, i) => s + (i.valor_alocado || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{titulo}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground -mt-2">
          {itens?.length || 0} lançamentos · {fmt(total)}
        </div>
        <div className="divide-y">
          {(itens || []).map((i) => (
            <div key={i.id} className="py-2 flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{i.descricao || '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {i.data ? i.data.split('-').reverse().join('/') : 's/ data'} · {i.entidade_tipo}
                </p>
              </div>
              <span className="tabular-nums font-semibold shrink-0">{fmt(i.valor_alocado)}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}