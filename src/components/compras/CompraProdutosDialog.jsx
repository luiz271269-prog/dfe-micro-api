import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';

export default function CompraProdutosDialog({ documento, onClose }) {
  return <Dialog open={!!documento} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{documento?.tipo} {documento?.numero} · Produtos da compra</DialogTitle>
      </DialogHeader>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/40">
            <th className="p-3 text-left">Produto</th><th className="p-3 text-right">Qtd.</th>
            <th className="p-3 text-right">Unitário</th><th className="p-3 text-right">Total</th>
          </tr></thead>
          <tbody>{documento?.itens.map((item) => <tr key={item.id} className="border-b last:border-0">
            <td className="p-3">{item.descricao_produto || 'Produto não informado'}</td>
            <td className="p-3 text-right tabular-nums">{item.quantidade || 1}</td>
            <td className="p-3 text-right tabular-nums">{item.valor_unitario ? formatCurrency(item.valor_unitario) : '—'}</td>
            <td className="p-3 text-right font-semibold tabular-nums">{formatCurrency(item.valor_total || 0)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </DialogContent>
  </Dialog>;
}