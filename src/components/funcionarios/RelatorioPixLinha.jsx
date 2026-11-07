import { useState } from 'react';
import { ChevronDown, ChevronUp, Palmtree, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { SITUACAO_RASTREIO, TIPO_PIX } from './rastreioPixRotulos';

const v = n => (n > 0 ? formatCurrency(n) : '—');

export default function RelatorioPixLinha({ comp }) {
  const [aberto, setAberto] = useState(false);
  const sit = SITUACAO_RASTREIO[comp.situacao] || SITUACAO_RASTREIO.vencida;
  const naoConta = comp.pix_a_confirmar + comp.pix_suspeito;

  return (
    <div className="border-b last:border-b-0">
      <button onClick={() => setAberto(!aberto)} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/20 text-left">
        <span className="font-mono text-xs font-bold w-16 shrink-0">{comp.competencia}</span>
        {comp.tipo === 'ferias' && <Palmtree className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-7 gap-2 text-xs tabular-nums">
          <span>Devido: <b>{formatCurrency(comp.liquido)}</b></span>
          <span className="text-muted-foreground">Vence: <b className="text-foreground">{comp.vencimento ? formatDate(comp.vencimento) : '—'}</b></span>
          <span className="text-green-700">Salário: <b>{v(comp.pix_salario + comp.pix_complemento)}</b></span>
          <span className="text-blue-700">Comissão: <b>{v(comp.pix_comissao)}</b></span>
          <span className="text-yellow-700">Vales: <b>{v(comp.pix_adiantamentos)}</b></span>
          <span className="text-sky-700">A conferir: <b>{v(naoConta)}</b></span>
          <span className={comp.diferenca > 50 ? 'text-orange-700' : 'text-green-700'}>Saldo: <b>{formatCurrency(comp.diferenca)}</b></span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${sit.cls}`}>{sit.label}</span>
        {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {aberto && (
        <div className="px-4 pb-3 bg-muted/10 space-y-1">
          <p className="text-[11px] text-muted-foreground mb-2">
            Janela de pagamento: {comp.janela_inicio ? `${formatDate(comp.janela_inicio)} a ` : ''}{comp.vencimento ? formatDate(comp.vencimento) : 'sem vencimento'}
            {comp.data_salario && ` · salário pago em ${formatDate(comp.data_salario)}`} · vales e PIX a conferir não abatem o saldo.
          </p>
          {comp.pix.length === 0 ? <p className="text-xs text-muted-foreground italic">Nenhum PIX vinculado a esta competência</p> : comp.pix.map((px, i) => {
            const tc = TIPO_PIX[px.tipo] || TIPO_PIX.complemento;
            return (
              <div key={i} className="text-xs bg-card border rounded px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground w-20 shrink-0">{formatDate(px.data)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${tc.color}`}>{tc.label}</span>
                  <span className="flex-1 truncate text-muted-foreground">{px.descricao}</span>
                  <span className="font-bold tabular-nums shrink-0">{formatCurrency(px.valor)}</span>
                </div>
                <p className="pl-[5.5rem] text-[11px] text-muted-foreground">{px.motivo}</p>
                {px.alertas.map(a => <p key={a} className="pl-[5.5rem] text-[11px] text-orange-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{a}</p>)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}