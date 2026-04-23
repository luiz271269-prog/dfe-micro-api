import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { formatCurrency } from '../../lib/formatters';

export default function GraficoHistoricoCusto({ serie, regime }) {
  if (!serie || serie.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-6 text-center text-xs text-muted-foreground">
        Sem dados históricos suficientes para este SKU
      </div>
    );
  }

  const data = serie.map(s => ({
    data: s.data.slice(5), // MM-DD
    dataCompleta: s.data,
    fornecedor: s.fornecedor,
    nfe: s.nfe,
    'Valor unitário (base)': Number(s.valor_unitario.toFixed(2)),
    'Custo unitário efetivo': Number(s.custo_unitario_efetivo.toFixed(2)),
  }));

  const medios = data.reduce((s, d) => s + d['Custo unitário efetivo'], 0) / data.length;
  const regimeLabel = regime === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido/Real';

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">Histórico de custo do SKU</p>
          <p className="text-[10px] text-muted-foreground">
            {data.length} compras · regime simulado: <strong>{regimeLabel}</strong> · média efetiva: <strong>{formatCurrency(medios)}</strong>
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="data" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v, true)} />
          <Tooltip
            formatter={(value) => formatCurrency(value)}
            labelFormatter={(label, payload) => {
              const item = payload?.[0]?.payload;
              return item ? `${item.dataCompleta} · ${item.fornecedor} (NF ${item.nfe})` : label;
            }}
            contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <ReferenceLine y={medios} stroke="#6366f1" strokeDasharray="3 3" label={{ value: 'Média', fontSize: 9, fill: '#6366f1' }} />
          <Line type="monotone" dataKey="Valor unitário (base)" stroke="#94a3b8" strokeWidth={1.5} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="Custo unitário efetivo" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}