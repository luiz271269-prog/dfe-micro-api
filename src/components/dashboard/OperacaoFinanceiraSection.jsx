import { Link } from 'react-router-dom';
import { ShoppingCart, ReceiptText, CreditCard, Landmark, Users, Hammer, WalletCards, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

function OperacaoCard({ title, value, detail, icon: Icon, href, onClick }) {
  return (
    <article className="flex min-h-32 flex-col justify-between border-b border-r border-border/60 bg-card p-4">
      <button onClick={onClick} className="text-left">
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p><Icon className="h-4 w-4 text-primary" /></div>
        <p className="mt-3 text-xl font-bold tabular-nums text-foreground">{formatCurrency(value)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </button>
      <Link to={href} className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Abrir módulo <ExternalLink className="h-3 w-3" /></Link>
    </article>
  );
}

export default function OperacaoFinanceiraSection({ summary, consolidated, onDrill }) {
  const cards = [
    { title: 'Compras', value: consolidated.compras.total, detail: `${consolidated.compras.count} registros · ticket ${formatCurrency(consolidated.compras.ticket, true)}`, icon: ShoppingCart, href: '/compras', drill: 'comprasConsolidadas' },
    { title: 'Despesas fixas/variáveis', value: consolidated.despesas.total, detail: `Fixas ${formatCurrency(consolidated.despesas.fixas, true)} · variáveis ${formatCurrency(consolidated.despesas.variaveis, true)}`, icon: ReceiptText, href: '/despesas', drill: 'despesasConsolidadas' },
    { title: 'Cartões', value: summary.totalCartoes, detail: `${summary.nCartoes} cartão(ões) · próxima fatura ${formatCurrency(summary.proxVenc, true)}`, icon: CreditCard, href: '/cartoes', drill: 'cartoes' },
    { title: 'Tributos a pagar', value: summary.totalTrib, detail: `${summary.tribVencer} a vencer · ${summary.tribVencidos} vencido(s)`, icon: Landmark, href: '/tributos', drill: 'tributos' },
    { title: 'Folha de pagamento', value: consolidated.folha.total, detail: `${summary.funcAtivos} colaboradores ativos`, icon: Users, href: '/funcionarios', drill: 'folhaConsolidada' },
    { title: 'Obras e reformas', value: consolidated.obras.total, detail: `Orçado ${formatCurrency(consolidated.obras.orcado, true)}`, icon: Hammer, href: '/obras', drill: 'obrasConsolidadas' },
    { title: 'Pró-labore', value: consolidated.proLabore.total, detail: 'Banco e cartões classificados', icon: WalletCards, href: '/prolabore', drill: 'proLaboreConsolidado' },
  ];
  return <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"><header className="bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-3 text-white"><h2 className="text-sm font-bold uppercase tracking-widest">Operação Financeira</h2><p className="text-xs text-white/75">Visão operacional completa dos módulos financeiros</p></header><div className="grid sm:grid-cols-2 lg:grid-cols-4">{cards.map((card) => <OperacaoCard key={card.title} {...card} onClick={() => onDrill(card.drill)} />)}</div></section>;
}