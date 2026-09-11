import { ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '@/lib/formatters';

const tooltip = (value) => formatCurrency(value);
export default function FluxoConsolidadoChart({ data }) {
  const bridge = [{ name: 'Faturamento', value: data.faturamento }, { name: 'Compras', value: -data.compras.total }, { name: 'Despesas', value: -data.despesas.total }, { name: 'Impostos', value: -data.impostos.total }, { name: 'Folha', value: -data.folha.total }, { name: 'Obras', value: -data.obras.total }, { name: 'Pró-labore', value: -data.proLabore.total }, { name: 'Resultado', value: data.resultado }];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-card p-4"><h3 className="mb-3 text-sm font-bold">Ponte do resultado</h3><ResponsiveContainer width="100%" height={240}><BarChart data={bridge}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tickFormatter={(v) => formatCurrency(v, true)} /><Tooltip formatter={tooltip} /><Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div className="rounded-2xl border bg-card p-4"><h3 className="mb-3 text-sm font-bold">Evolução dos últimos 12 meses</h3><ResponsiveContainer width="100%" height={240}><ComposedChart data={data.chart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tickFormatter={(v) => formatCurrency(v, true)} /><Tooltip formatter={tooltip} /><Legend /><Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--chart-1))" /><Bar dataKey="custos" name="Custos diretos" fill="hsl(var(--chart-2))" /><Line dataKey="resultado" name="Resultado" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div>
    </div>
  );
}