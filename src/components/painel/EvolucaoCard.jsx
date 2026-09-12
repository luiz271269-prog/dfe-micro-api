import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { fmtMes } from '@/components/shared/MonthNavigator';

export default function EvolucaoCard({ historico = [] }) {
  const dados = historico.map((h) => ({ ...h, label: fmtMes(h.mes).slice(0, 3) }));
  return (
    <div className="bg-card rounded-2xl border shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-muted-foreground" /> Evolução dos Resultados</h2>
        <span className="text-[11px] font-semibold bg-muted rounded-full px-2 py-0.5">Últimos {historico.length} meses</span>
      </div>
      <div className="h-44">
        <ResponsiveContainer>
          <ComposedChart data={dados} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, true)} />
            <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(l, p) => p?.[0]?.payload?.mes || l} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="faturamento" name="Faturamento" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="resultadoOperacao" name="Resultado Operação" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Line dataKey="resultadoCaixa" name="Resultado Caixa" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}