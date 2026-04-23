import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { historicoPorFornecedor } from '../../lib/custoSimulacaoEngine';

const CORES = ['#4f46e5', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#65a30d'];

export default function GraficoHistoricoSKU({ sku, regime }) {
  const { serieData, fornecedores } = useMemo(() => {
    const porForn = historicoPorFornecedor(sku);
    const campoCusto = regime === 'simples_nacional' ? 'custo_unitario_efetivo_simples' : 'custo_unitario_efetivo_normal';

    // Juntar todas as datas em eixo X comum
    const datasSet = new Set();
    Object.values(porForn).forEach(arr => arr.forEach(p => datasSet.add(p.data)));
    const datas = [...datasSet].sort();

    const data = datas.map(d => {
      const ponto = { data: d };
      Object.entries(porForn).forEach(([forn, arr]) => {
        const p = arr.find(x => x.data === d);
        if (p) ponto[forn] = p[campoCusto];
      });
      return ponto;
    });

    return { serieData: data, fornecedores: Object.keys(porForn) };
  }, [sku, regime]);

  if (sku.qtd_ocorrencias < 2) {
    return (
      <div className="bg-card border rounded-xl p-6 text-center">
        <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-semibold">Histórico insuficiente</p>
        <p className="text-xs text-muted-foreground">Este SKU possui apenas 1 ocorrência. Necessário ≥2 para gráfico comparativo.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Histórico de custo unitário efetivo</p>
          <p className="text-[10px] text-muted-foreground">Regime: {regime === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido/Real'} · {fornecedores.length} fornecedor(es) · {sku.qtd_ocorrencias} ocorrências</p>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serieData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="data"
              tick={{ fontSize: 10 }}
              tickFormatter={d => d ? d.slice(5) : ''}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={v => formatCurrency(v, true)}
            />
            <Tooltip
              formatter={(v) => formatCurrency(v)}
              labelFormatter={d => `Emissão: ${d}`}
              contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            {fornecedores.map((f, i) => (
              <Line
                key={f}
                type="monotone"
                dataKey={f}
                stroke={CORES[i % CORES.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela resumo por fornecedor */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-2 py-1.5">Fornecedor</th>
              <th className="text-right px-2 py-1.5">Ocorr.</th>
              <th className="text-right px-2 py-1.5">Qtd total</th>
              <th className="text-right px-2 py-1.5">Unit. médio</th>
              <th className="text-right px-2 py-1.5">Mín</th>
              <th className="text-right px-2 py-1.5">Máx</th>
              <th className="text-right px-2 py-1.5">Variação</th>
            </tr>
          </thead>
          <tbody>
            {fornecedores.map((f, i) => {
              const linhasF = sku.linhas.filter(l => l.fornecedor === f);
              const qtd = linhasF.reduce((s, l) => s + l.quantidade, 0);
              const valor = linhasF.reduce((s, l) => s + l.valor_total, 0);
              const unitMedio = qtd > 0 ? valor / qtd : 0;
              const unitarios = linhasF.map(l => l.valor_unitario).filter(v => v > 0);
              const min = unitarios.length ? Math.min(...unitarios) : 0;
              const max = unitarios.length ? Math.max(...unitarios) : 0;
              const variacao = min > 0 ? ((max - min) / min) * 100 : 0;
              return (
                <tr key={f} className="border-b">
                  <td className="px-2 py-1.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CORES[i % CORES.length] }} />
                    <span className="truncate max-w-[200px]">{f}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right">{linhasF.length}</td>
                  <td className="px-2 py-1.5 text-right">{qtd.toFixed(qtd % 1 === 0 ? 0 : 2)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-bold">{formatCurrency(unitMedio)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{formatCurrency(min)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-rose-600">{formatCurrency(max)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums font-bold ${variacao > 20 ? 'text-rose-600' : variacao > 10 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {variacao.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}