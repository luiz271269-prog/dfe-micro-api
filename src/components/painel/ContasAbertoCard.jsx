import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export default function ContasAbertoCard({ aberto }) {
  const [aba, setAba] = useState('receber');
  const g = aba === 'receber' ? aberto.aReceber : aberto.aPagar;
  const link = aba === 'receber' ? '/cobrancas' : '/contas-a-pagar';
  return (
    <div className="bg-card rounded-2xl border shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold flex items-center gap-2"><Wallet className="w-4 h-4 text-muted-foreground" /> Contas em Aberto</h2>
        <Link to={link} className="text-[11px] font-semibold text-primary hover:underline">Ver todas</Link>
      </div>
      <div className="grid grid-cols-2 gap-1 bg-muted rounded-lg p-1 mb-2">
        {[['receber', 'A Receber'], ['pagar', 'A Pagar']].map(([k, l]) => (
          <button key={k} onClick={() => setAba(k)} className={`text-xs font-semibold rounded-md py-1 transition-colors ${aba === k ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-background'}`}>{l}</button>
        ))}
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
    </div>
  );
}