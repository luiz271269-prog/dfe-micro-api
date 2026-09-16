import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { FORMAS_COMPRA } from '@/components/compras/CompraPagamentoFields';
import CompraProdutosDialog from '@/components/compras/CompraProdutosDialog';

const statusLabel = { pendente: 'Pendente', parcial: 'Parcial', nao_identificado: 'Não identificado' };
export default function ComprasTitulosTable({ documentos, loading = false, embedded = false }) {
  const [selecionado, setSelecionado] = useState(null);
  const tabela = <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead><tr className="border-b bg-muted/30">
      <th className="p-3 text-left">Vencimento</th><th className="p-3 text-left">Nota / parcela</th>
      <th className="p-3 text-left">Fornecedor</th><th className="p-3 text-left">Pagamento</th>
      <th className="p-3 text-left">Status</th><th className="p-3 text-right">Em aberto</th><th className="p-3 text-right">Ação</th>
    </tr></thead>
    <tbody>{loading ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Carregando...</td></tr>
      : documentos.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Nenhuma nota ou parcela em aberto</td></tr>
      : documentos.map((doc) => <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20">
        <td className="p-3 whitespace-nowrap">{doc.data_vencimento ? formatDate(doc.data_vencimento) : 'Sem vencimento'}</td>
        <td className="p-3"><p className="font-semibold">{doc.tipo} {doc.numero}</p><p className="text-xs text-muted-foreground">Parcela {doc.parcela}</p></td>
        <td className="p-3">{doc.fornecedor}</td><td className="p-3 text-xs">{FORMAS_COMPRA[doc.forma_pagamento] || 'Não informada'}</td>
        <td className="p-3">{statusLabel[doc.status_pagamento] || doc.status_pagamento}</td>
        <td className="p-3 text-right font-bold tabular-nums text-destructive">{formatCurrency(doc.valor)}</td>
        <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => setSelecionado(doc)}>Mais <ChevronRight className="h-4 w-4" /></Button></td>
      </tr>)}</tbody>
    {documentos.length > 0 && <tfoot><tr className="border-t-2 bg-muted/30"><td colSpan={5} className="p-3 font-semibold">Total ({documentos.length} títulos)</td><td className="p-3 text-right font-bold text-destructive">{formatCurrency(documentos.reduce((s, d) => s + d.valor, 0))}</td><td /></tr></tfoot>}
  </table></div>;
  return <>{embedded ? tabela : <div className="rounded-xl border bg-card overflow-hidden">{tabela}</div>}<CompraProdutosDialog documento={selecionado} onClose={() => setSelecionado(null)} /></>;
}