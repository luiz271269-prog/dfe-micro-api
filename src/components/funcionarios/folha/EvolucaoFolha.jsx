import { BarChart3 } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../../lib/formatters';
import { rotuloMesCurto } from '../../../lib/folhaDashboardEngine';

export default function EvolucaoFolha({ resumos }) {
  const data = resumos.map(r => ({ mes: rotuloMesCurto(r.competencia), liquido: r.liquido, bruto: r.bruto, qtd: r.qtd }));
  return (
    <div className="bg-card border rounded-xl p-4">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
        <BarChart3 className="w-3.5 h-3.5" /> Evolução da Folha — Mensal
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={45} />
          <YAxis yAxisId="valor" tick={{ fontSize: 9 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
          <YAxis yAxisId="qtd" orientation="right" tick={{ fontSize: 9 }} allowDecimals={false} />
          <Tooltip formatter={(v, name) => name === 'Funcionários' ? v : formatCurrency(v)} />
          <Bar yAxisId="valor" dataKey="liquido" name="Líquido" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
          <Line yAxisId="qtd" type="monotone" dataKey="qtd" name="Funcionários" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}