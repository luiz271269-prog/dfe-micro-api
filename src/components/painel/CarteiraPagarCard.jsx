import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import CarteiraPagarEstado from '@/components/painel/CarteiraPagarEstado';
import SincronizarComprasButton from '@/components/contas-pagar/SincronizarComprasButton';

export default function CarteiraPagarCard({ consulta }) {
  const { data, error } = consulta;
  return <section id="contas-a-pagar-painel" className="rounded-2xl border bg-card p-4 shadow-sm">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 font-bold"><Wallet className="h-4 w-4 text-primary" /> Contas a Pagar por origem</h2><p className="text-xs text-muted-foreground">Obrigações registradas menos pagamentos informados, sem misturar pagamentos já realizados.</p></div>
      <div className="flex flex-wrap items-center gap-3">{data?.podeSincronizar && <SincronizarComprasButton />}<Link to="/contas-a-pagar" className="text-sm font-semibold text-primary hover:underline">Ver contas</Link></div>
    </header>
    <CarteiraPagarEstado consulta={consulta} />
    {data && !error && <>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground"><tr><th className="px-3 py-2 text-left">Origem</th><th className="px-3 py-2 text-right">Em aberto</th><th className="px-3 py-2 text-right">Previsto, sem documento</th></tr></thead>
        <tbody>{data.grupos.map(g => <tr key={g.chave} className="border-b last:border-b-0"><td className="px-3 py-2"><Link to={g.href} className="hover:text-primary hover:underline">{g.rotulo}</Link></td><td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(g.confirmado)}</td><td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(g.previsto)}</td></tr>)}</tbody>
        <tfoot className="border-t bg-muted/40 font-bold"><tr><td className="px-3 py-2">Totais separados</td><td className="px-3 py-2 text-right tabular-nums">{formatCurrency(data.totalConfirmado)}</td><td className="px-3 py-2 text-right tabular-nums">{formatCurrency(data.totalPrevisto)}</td></tr></tfoot>
      </table></div>
      <p className="mt-3 text-xs text-muted-foreground">Compras: pedidos sincronizados do Nexus Cotações/Central de Compras e registros locais, preservando as baixas locais; compras vinculadas ao cartão são cobradas pela fatura, não novamente pelo fornecedor.</p>
      <p className="mt-1 text-xs text-muted-foreground">Previsões de <Link to="/recorrentes" className="text-primary hover:underline">despesas fixas cadastradas</Link> ficam separadas e deixam de ser somadas quando já existe o documento da ocorrência; folha e impostos entram pelas obrigações registradas.</p>
    </>}
  </section>;
}