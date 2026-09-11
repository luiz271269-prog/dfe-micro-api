import { ShoppingCart, ReceiptText, Landmark, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import CustoBucketBars from './CustoBucketBars';

function Card({ title, data, icon: Icon, detail, onClick, children }) {
  return <button onClick={onClick} className="rounded-xl border bg-card p-4 text-left shadow-sm hover:bg-muted/30"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase text-muted-foreground">{title}</span><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 text-xl font-bold">{formatCurrency(data.total)}</p><p className="mb-3 text-xs text-muted-foreground">{data.percent.toFixed(1)}% do faturamento · {detail}</p>{children}</button>;
}

export default function CustosDiretosSection({ data, onDrill }) {
  return (
    <section className="space-y-3"><div><h2 className="font-bold">Custos Diretos sobre Faturamento</h2><p className="text-xs text-muted-foreground">Compras, despesas, impostos e folha</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Card title="Compras — estoque/revenda" data={data.compras} icon={ShoppingCart} detail={`${data.compras.count} compras · ticket ${formatCurrency(data.compras.ticket, true)}`} onClick={() => onDrill('comprasConsolidadas')}><CustoBucketBars buckets={data.compras.buckets} /></Card>
      <Card title="Despesas fixas/variáveis" data={data.despesas} icon={ReceiptText} detail="por modalidade" onClick={() => onDrill('despesasConsolidadas')}><CustoBucketBars buckets={data.despesas.buckets} /></Card>
      <Card title="Impostos" data={data.impostos} icon={Landmark} detail={`Vendas ${formatCurrency(data.impostos.vendas, true)} · Folha ${formatCurrency(data.impostos.encargos, true)}`} onClick={() => onDrill('impostosConsolidados')}><div className="text-xs text-muted-foreground">Tributos de vendas e encargos separados</div></Card>
      <Card title="Folha de pagamento" data={data.folha} icon={Users} detail={`${data.folha.ativos} ativos · média ${formatCurrency(data.folha.medio, true)}`} onClick={() => onDrill('folhaConsolidada')}><div className="text-xs text-muted-foreground">Custo por competência ou caixa realizado</div></Card>
    </div></section>
  );
}