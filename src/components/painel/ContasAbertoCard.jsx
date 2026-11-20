import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export default function ContasAbertoCard({ aberto }) {
  const g = aberto.aReceber;
  return (
    <div className="bg-card rounded-2xl border shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold flex items-center gap-2"><Wallet className="w-4 h-4 text-muted-foreground" /> Contas a Receber</h2>
        <Link to="/cobrancas" className="text-[11px] font-semibold text-primary hover:underline">Ver todas</Link>
      </div>
      <div className="h-32">
        <ResponsiveContainer>
          <BarChart data={g.faixas} margin={{ top: 5, right: 5, left: -15, bottom: 0 }} barCategoryGap="25%">
            <XAxis dataKey="faixa" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, true)} />
            <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="aVencer" name="A vencer" stackId="a" fill="#10b981" />
            <Bar dataKey="vencido" name="Vencido" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-4 text-center text-[11px] mt-1">
        {g.faixas.map((f) => <div key={f.faixa}><p className="text-muted-foreground">{f.faixa} dias</p><p className="font-bold tabular-nums">{formatCurrency(f.aVencer + f.vencido, true)}</p></div>)}
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-2">{g.registros} registro(s) · total {formatCurrency(g.total)}</p>
      {aberto.dataCorte && <p className="text-[10px] text-muted-foreground text-center">Aging {aberto.modoAging === 'fechamento' ? 'do fechamento' : 'operacional'} · corte em {aberto.dataCorte.split('-').reverse().join('/')}</p>}
    </div>
  );
}