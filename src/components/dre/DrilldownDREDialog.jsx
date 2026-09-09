import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';

export default function DrilldownDREDialog({ aberto, onFechar, titulo, itens }) {
  const comp = itens?.competencia || [];
  const caixa = itens?.caixa || [];

  const Tabela = ({ lista, cor, rotulo }) => (
    <div className="min-w-0">
      <p className={`text-[11px] font-bold uppercase mb-1 ${cor}`}>
        {rotulo} · {lista.length} lançamento{lista.length === 1 ? '' : 's'} ·{' '}
        {formatCurrency(lista.reduce((s, i) => s + (i.valor || 0), 0))}
      </p>
      <div className="border rounded-lg overflow-x-auto max-h-[45vh] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-muted/60">
            <tr className="border-b">
              <th className="text-left px-2 py-1.5">Data</th>
              <th className="text-left px-2 py-1.5">Descrição</th>
              <th className="text-left px-2 py-1.5">Empresa</th>
              <th className="text-left px-2 py-1.5">Origem</th>
              <th className="text-right px-2 py-1.5">Valor</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">
                  Nenhum lançamento
                </td>
              </tr>
            )}
            {lista.map((i, idx) => (
              <tr key={idx} className="border-b">
                <td className="px-2 py-1.5 whitespace-nowrap">{i.data || '—'}</td>
                <td className="px-2 py-1.5 max-w-[260px] truncate font-medium">{i.descricao}</td>
                <td className="px-2 py-1.5">{i.empresa}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{i.origem}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                  {formatCurrency(i.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-base">{titulo}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Tabela lista={comp} cor="text-blue-700" rotulo="Competência" />
          <Tabela lista={caixa} cor="text-emerald-700" rotulo="Caixa" />
        </div>
      </DialogContent>
    </Dialog>
  );
}