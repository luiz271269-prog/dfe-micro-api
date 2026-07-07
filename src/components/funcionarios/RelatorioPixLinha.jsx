import { useState } from 'react';
import { ChevronDown, ChevronUp, Palmtree, Clock, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

const TIPO_PIX = {
  salario:      { label: 'Salário',      color: 'bg-green-100 text-green-700' },
  comissao:     { label: 'Comissão',     color: 'bg-blue-100 text-blue-700' },
  complemento:  { label: 'Complemento',  color: 'bg-teal-100 text-teal-700' },
  adiantamento: { label: 'Adiantamento', color: 'bg-yellow-100 text-yellow-800' },
};

export default function RelatorioPixLinha({ comp }) {
  const [aberto, setAberto] = useState(false);
  const quitada = Math.abs(comp.diferenca) <= 50;
  const p = comp.pontualidade;

  return (
    <div className="border-b last:border-b-0">
      <button onClick={() => setAberto(!aberto)} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/20 text-left">
        <span className="font-mono text-xs font-bold w-16 shrink-0">{comp.competencia}</span>
        {comp.tipo === 'ferias' && <Palmtree className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs tabular-nums">
          <span>Devido: <b>{formatCurrency(comp.liquido)}</b></span>
          <span className="text-green-700">Salário: <b>{comp.pix_salario > 0 ? formatCurrency(comp.pix_salario) : '—'}</b></span>
          <span className="text-blue-700">Comissão: <b>{comp.pix_comissao > 0 ? formatCurrency(comp.pix_comissao) : '—'}</b></span>
          <span className="text-yellow-700">Vales: <b>{comp.pix_adiantamentos > 0 ? formatCurrency(comp.pix_adiantamentos) : '—'}</b></span>
          <span className={comp.diferenca > 50 ? 'text-orange-700' : 'text-green-700'}>
            Saldo: <b>{formatCurrency(comp.diferenca)}</b>
          </span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${quitada ? 'bg-green-100 text-green-700' : comp.total_pago > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
          {quitada ? 'Quitada' : comp.total_pago > 0 ? 'Parcial' : 'Pendente'}
        </span>
        {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {aberto && (
        <div className="px-4 pb-3 bg-muted/10">
          {p && (
            <div className={`flex items-center gap-1.5 text-[11px] mb-2 ${p.no_prazo ? 'text-green-700' : 'text-orange-700'}`}>
              {p.no_prazo ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              5º dia útil: {formatDate(p.data_esperada)} · pago em {formatDate(p.data_real)}
              {' '}({p.dias_diferenca === 0 ? 'em dia' : p.dias_diferenca > 0 ? `${p.dias_diferenca}d depois` : `${-p.dias_diferenca}d antes`})
            </div>
          )}
          {comp.pix.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum PIX vinculado a esta competência</p>
          ) : (
            <div className="space-y-1">
              {comp.pix.map((px, i) => {
                const tc = TIPO_PIX[px.tipo] || TIPO_PIX.complemento;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs bg-card border rounded px-2 py-1.5">
                    <span className="font-mono text-muted-foreground w-20 shrink-0">{formatDate(px.data)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${tc.color}`}>{tc.label}</span>
                    <span className="flex-1 truncate text-muted-foreground">{px.descricao}</span>
                    <span className="font-bold tabular-nums shrink-0">{formatCurrency(px.valor)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}