import { formatCurrency } from '../../lib/formatters';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

function Linha({ label, valor, indent = 0, bold, negative, highlight }) {
  return (
    <div className={`flex items-center justify-between py-1.5 px-3 text-xs ${highlight ? 'bg-amber-50' : ''} ${bold ? 'border-t-2 border-foreground/20 font-bold bg-muted/40' : 'border-b border-border/20'}`}>
      <span style={{ paddingLeft: `${indent * 14}px` }} className={bold ? 'uppercase' : ''}>{label}</span>
      <span className={`tabular-nums ${negative ? 'text-rose-600' : ''} ${bold ? 'font-bold' : ''}`}>
        {negative && valor > 0 ? '(' : ''}{formatCurrency(valor)}{negative && valor > 0 ? ')' : ''}
      </span>
    </div>
  );
}

export default function DRESimuladoCard({ titulo, subtitulo, calc, regime, variacao, color = 'indigo' }) {
  const colors = {
    indigo: 'from-indigo-600 to-purple-600',
    emerald: 'from-emerald-600 to-teal-600',
    rose: 'from-rose-600 to-red-600',
  };

  const Icon = variacao == null ? Minus : variacao < 0 ? TrendingDown : variacao > 0 ? TrendingUp : Minus;
  const varColor = variacao == null ? 'text-muted-foreground' : variacao < 0 ? 'text-emerald-600' : variacao > 0 ? 'text-rose-600' : 'text-muted-foreground';

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className={`bg-gradient-to-r ${colors[color]} text-white px-3 py-2`}>
        <p className="text-xs font-bold">{titulo}</p>
        <p className="text-[10px] opacity-90">{subtitulo}</p>
      </div>
      <div className="p-1">
        <Linha label="Valor do produto (base)" valor={calc.valor_produto} />
        <Linha label="(+) ICMS-ST" valor={calc.adicoes.icms_st} indent={1} />
        <Linha label="(+) IPI" valor={calc.adicoes.ipi} indent={1} />
        {regime !== 'simples_nacional' && (
          <>
            <Linha label="(–) ICMS a recuperar" valor={calc.creditos.icms} indent={1} negative />
            <Linha label="(–) PIS a recuperar" valor={calc.creditos.pis} indent={1} negative />
            <Linha label="(–) COFINS a recuperar" valor={calc.creditos.cofins} indent={1} negative />
          </>
        )}
        <Linha label="= Custo efetivo" valor={calc.custo_efetivo} bold highlight />
      </div>
      <div className="px-3 py-2 bg-muted/30 border-t flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-bold">Unitário efetivo</p>
          <p className="text-sm font-bold tabular-nums">{formatCurrency(calc.custo_unitario_efetivo)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-muted-foreground font-bold">Impacto tributário</p>
          <p className={`text-sm font-bold ${calc.impacto_pct > 0 ? 'text-rose-600' : calc.impacto_pct < 0 ? 'text-emerald-600' : ''}`}>
            {calc.impacto_pct >= 0 ? '+' : ''}{calc.impacto_pct.toFixed(2)}%
          </p>
        </div>
        {variacao != null && (
          <div className="text-right">
            <p className="text-[10px] uppercase text-muted-foreground font-bold">vs. atual</p>
            <p className={`text-sm font-bold flex items-center gap-1 justify-end ${varColor}`}>
              <Icon className="w-3.5 h-3.5" />
              {variacao >= 0 ? '+' : ''}{formatCurrency(variacao)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}