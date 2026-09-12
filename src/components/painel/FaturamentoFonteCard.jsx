import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { fmtMes } from '@/components/shared/MonthNavigator';

const CORES = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

export default function FaturamentoFonteCard({ operacao, mes, onDrill }) {
  const f = operacao.faturamento.fontes;
  const itens = [
    { nome: 'Produtos', linha: f.produtos },
    { nome: 'Serviços', linha: f.servicos },
    { nome: 'Locações', linha: f.locacoes },
  ].map((i, idx) => ({ ...i, valor: i.linha.valor, cor: CORES[idx] }));
  const total = operacao.faturamento.valor;
  return (
    <div className="bg-card rounded-2xl border shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold flex items-center gap-2"><PieIcon className="w-4 h-4 text-muted-foreground" /> Faturamento por Fonte</h2>
        <span className="text-[11px] font-semibold bg-muted rounded-full px-2 py-0.5">{fmtMes(mes)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative w-36 h-36 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={itens.filter((i) => i.valor > 0)} dataKey="valor" innerRadius={45} outerRadius={65} paddingAngle={2} stroke="none">
                {itens.filter((i) => i.valor > 0).map((i) => <Cell key={i.nome} fill={i.cor} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-bold tabular-nums">{formatCurrency(total, true)}</span>
            <span className="text-[10px] text-muted-foreground">Total</span>
          </div>
        </div>
        <ul className="flex-1 space-y-1.5 text-xs">
          {itens.map((i) => (
            <li key={i.nome} onClick={() => i.linha.registros > 0 && onDrill(i.linha)} className={`flex items-center gap-2 ${i.linha.registros > 0 ? 'cursor-pointer hover:underline' : ''}`}>
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: i.cor }} />
              <span className="flex-1">{i.nome}</span>
              <span className="text-muted-foreground tabular-nums w-12 text-right">{total ? `${((i.valor / total) * 100).toFixed(1)}%` : '—'}</span>
              <span className="font-semibold tabular-nums w-24 text-right">{formatCurrency(i.valor)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}