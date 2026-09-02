import { DollarSign, TrendingUp, Users, BarChart3, CheckCircle2, Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency } from '../../../lib/formatters';
import { variacaoPct } from '../../../lib/folhaDashboardEngine';

function Variacao({ atual, anterior, inverso = false }) {
  const v = variacaoPct(atual, anterior);
  if (v === null) return <p className="text-[10px] text-muted-foreground">sem período anterior</p>;
  const sobe = v >= 0;
  const bom = inverso ? !sobe : sobe;
  const Icon = sobe ? ArrowUp : ArrowDown;
  return (
    <p className={`text-[10px] font-semibold flex items-center gap-0.5 ${bom ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon className="w-3 h-3" /> {Math.abs(v).toFixed(1)}% vs mês anterior
    </p>
  );
}

export default function KPIsFolha({ atual, anterior, totalPago, totalSaldo }) {
  const cards = [
    { label: 'Folha Bruta', sub: 'Mensal', value: formatCurrency(atual.bruto), icon: DollarSign, color: 'text-emerald-500', var: [atual.bruto, anterior.bruto, true] },
    { label: 'Folha Líquida', sub: 'Mensal', value: formatCurrency(atual.liquido), icon: TrendingUp, color: 'text-sky-500', var: [atual.liquido, anterior.liquido, true] },
    { label: 'Funcionários', sub: 'Na folha', value: atual.qtd, icon: Users, color: 'text-violet-500', var: [atual.qtd, anterior.qtd] },
    { label: 'Salário Médio', sub: 'Bruto por funcionário', value: formatCurrency(atual.media), icon: BarChart3, color: 'text-red-400', var: [atual.media, anterior.media, true] },
    { label: 'Pago', sub: 'Conciliado no extrato', value: formatCurrency(totalPago), icon: CheckCircle2, color: 'text-emerald-600', valueColor: 'text-emerald-700' },
    { label: 'A Pagar', sub: 'Saldo da competência', value: formatCurrency(totalSaldo), icon: Clock, color: 'text-orange-500', valueColor: totalSaldo > 0 ? 'text-orange-700' : 'text-emerald-700' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="bg-card border rounded-xl p-3 flex flex-col justify-between min-h-[92px]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{c.label}</p>
                <p className="text-[10px] text-muted-foreground/70">{c.sub}</p>
              </div>
              <Icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div>
              <p className={`text-lg font-bold tabular-nums leading-tight ${c.valueColor || ''}`}>{c.value}</p>
              {c.var && <Variacao atual={c.var[0]} anterior={c.var[1]} inverso={c.var[2]} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}