import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SeletorClassificacao from '@/components/shared/SeletorClassificacao';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Lançamentos do extrato sem vínculo: classificação manual direta nos eixos unificados.
export default function ClassificarNaoCobertos({ open, onOpenChange, lancs, onClassificado }) {
  const total = (lancs || []).reduce((s, l) => s + Math.abs(l.valor || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Lançamentos fora da matriz</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          {lancs?.length || 0} lançamentos · {fmt(total)} — classifique nos dois eixos para entrarem na matriz.
        </p>
        <div className="divide-y">
          {(lancs || []).map((l) => (
            <div key={l.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.descricao || '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {l.data ? l.data.split('-').reverse().join('/') : 's/ data'} · {l.categoria || '—'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <SeletorClassificacao
                  eixo="origem"
                  entityName="LancamentoBancario"
                  record={l}
                  field="origem_compra"
                  onChange={onClassificado}
                />
                <SeletorClassificacao
                  eixo="tipo"
                  entityName="LancamentoBancario"
                  record={l}
                  field="tipo_compra"
                  onChange={onClassificado}
                />
              </div>
              <span className="tabular-nums font-semibold shrink-0 w-24 text-right">
                {fmt(Math.abs(l.valor || 0))}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}