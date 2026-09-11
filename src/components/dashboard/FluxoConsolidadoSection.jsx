import { TrendingUp, Wallet, Scale, ArrowDownCircle, CircleDollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

function KPI({ label, value, sub, icon: Icon, onClick }) {
  return <button onClick={onClick} className="rounded-xl border bg-card p-3 text-left shadow-sm hover:bg-muted/30"><div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 text-lg font-bold tabular-nums">{formatCurrency(value)}</p><p className="text-[11px] text-muted-foreground">{sub}</p></button>;
}

export default function FluxoConsolidadoSection({ data, regime, onRegime, onDrill }) {
  const pct = (v) => `${v.toFixed(1)}% do faturamento`;
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Visão Consolidada</h2><p className="text-xs text-muted-foreground">Receita, custos e resultado sem dupla contagem</p></div><div className="flex rounded-lg border p-1">{['competencia', 'caixa'].map((item) => <button key={item} onClick={() => onRegime(item)} className={`rounded-md px-3 py-1 text-xs font-semibold ${regime === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{item === 'competencia' ? 'Competência' : 'Caixa realizado'}</button>)}</div></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><KPI label="Faturamento válido" value={data.faturamento} sub="NFs, CIs e integrações válidas" icon={TrendingUp} onClick={() => onDrill('faturamentoConsolidado')} /><KPI label="Custos diretos" value={data.custosDiretos} sub={pct(data.faturamento ? data.custosDiretos / data.faturamento * 100 : 0)} icon={Wallet} onClick={() => onDrill('custosDiretosConsolidado')} /><KPI label="Margem direta" value={data.margemDireta} sub={pct(data.faturamento ? data.margemDireta / data.faturamento * 100 : 0)} icon={Scale} onClick={() => onDrill('margemDiretaConsolidado')} /><KPI label="Outras saídas" value={data.outrasSaidas} sub={pct(data.faturamento ? data.outrasSaidas / data.faturamento * 100 : 0)} icon={ArrowDownCircle} onClick={() => onDrill('outrasSaidasConsolidado')} /><KPI label="Resultado final" value={data.resultado} sub={`${data.margemFinal.toFixed(1)}% de margem`} icon={CircleDollarSign} onClick={() => onDrill('resultadoConsolidado')} /></div>
    </section>
  );
}