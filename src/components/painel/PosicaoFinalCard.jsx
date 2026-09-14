import { Link } from 'react-router-dom';
import { Landmark, ShieldCheck, ShieldAlert, ShieldQuestion, Loader } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { fmtMes } from '@/components/shared/MonthNavigator';

const STATUS = {
  conciliado: { label: 'CONCILIADO', cls: 'bg-emerald-50 border-emerald-300 text-emerald-700', icon: ShieldCheck },
  em_conciliacao: { label: 'EM CONCILIAÇÃO', cls: 'bg-amber-50 border-amber-300 text-amber-700', icon: Loader },
  divergente: { label: 'DIVERGENTE', cls: 'bg-rose-50 border-rose-300 text-rose-700', icon: ShieldAlert },
  nao_verificavel: { label: 'NÃO VERIFICÁVEL', cls: 'bg-amber-50 border-amber-300 text-amber-700', icon: ShieldQuestion },
};
const fmt = (v) => (v == null ? '—' : formatCurrency(v));

export default function PosicaoFinalCard({ posicao: p, loopR, mes }) {
  const s = STATUS[loopR.status] || STATUS.nao_verificavel;
  const Icon = s.icon;
  return (
    <div className="bg-card rounded-2xl border shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold flex items-center gap-2"><Landmark className="w-4 h-4 text-muted-foreground" /> Posição Final de Caixa (Conciliação)</h2>
        <Link to="/extrato" className="text-[11px] font-semibold text-primary hover:underline">Ver contas bancárias</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_1.3fr] gap-2 items-center">
        <Bloco titulo="Saldo Inicial" valor={fmt(p.saldoInicial)} sub={`início de ${fmtMes(mes)}`} />
        <Op>+</Op>
        <Bloco titulo="Resultado de Caixa" valor={fmt(p.resultadoCaixa)} sub={fmtMes(mes)} cor={p.resultadoCaixa < 0 ? 'text-rose-600' : 'text-emerald-700'} />
        <Op>=</Op>
        <Bloco titulo="Saldo Final (Calculado)" valor={fmt(p.saldoCalculado)} />
        <Op>vs</Op>
        <Bloco titulo="Saldo Final (Bancos)" valor={fmt(p.saldoFinal)} sub={`${p.porConta.length} conta(s)`} />
        <div className={`rounded-xl border-2 px-3 py-2 flex items-center gap-3 ${s.cls}`}>
          <Icon className="w-7 h-7 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold opacity-80">Integridade Loop-R</p>
            <p className="text-sm font-extrabold">{s.label}</p>
            <p className="text-[11px]">Diferença: {fmt(p.diferencaBancaria)} · Classificação: {loopR.indicadores.coberturaClassificacao ?? '—'}%</p>
          </div>
        </div>
      </div>
      {loopR.motivos.length > 0 && (
        <ul className="mt-3 text-xs text-muted-foreground space-y-0.5 list-disc pl-5">
          {loopR.motivos.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </div>
  );
}

function Bloco({ titulo, valor, sub, cor = '' }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
      <p className="text-[11px] text-muted-foreground">{titulo}</p>
      <p className={`text-base font-bold tabular-nums ${cor}`}>{valor}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
const Op = ({ children }) => <span className="hidden md:block text-lg font-bold text-muted-foreground text-center">{children}</span>;