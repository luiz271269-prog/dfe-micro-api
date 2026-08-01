import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TIPOS_COMPRA } from '@/lib/classificacaoUnificada';

const NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtMes = (m) => `${NOMES[parseInt(m.split('-')[1], 10) - 1]}/${m.slice(2, 4)}`;
const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const CORES = [
  'hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
  'hsl(var(--destructive))', 'hsl(var(--muted-foreground))', 'hsl(var(--warning))',
  'hsl(var(--sidebar-primary))', 'hsl(var(--chart-3))', 'hsl(var(--secondary-foreground))',
];

const rotulo = (t) => TIPOS_COMPRA[t] || t.replace(/_/g, ' ');

export default function ComparativoReceitaCustos({ dados, tipos }) {
  const data = dados.map((d) => ({ ...d, label: fmtMes(d.mes) }));

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">Faturamento x custos mês a mês</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Receita das notas fiscais comparada aos custos classificados (folha, impostos, fretes, despesas e demais tipos)
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip formatter={(v, n) => [fmt(v), n]} labelFormatter={(l) => `Mês ${l}`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="receita" name="Faturamento" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            {tipos.map((t, i) => (
              <Bar
                key={t}
                dataKey={t}
                name={rotulo(t)}
                stackId="custos"
                fill={CORES[i % CORES.length]}
                radius={i === tipos.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
            <Line type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}