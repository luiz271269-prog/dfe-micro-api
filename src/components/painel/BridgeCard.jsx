import { useState } from 'react';
import { GitCompareArrows, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';

export default function BridgeCard({ bridge }) {
  const [detalhe, setDetalhe] = useState(false);
  const visiveis = bridge.ajustes.filter((a) => Math.abs(a.valor) >= 0.01);
  return (
    <div className="bg-card rounded-2xl border shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold flex items-center gap-2"><GitCompareArrows className="w-4 h-4 text-muted-foreground" /> Bridge de Reconciliação — Por que Operação ≠ Caixa?</h2>
        <Button size="sm" variant={detalhe ? 'secondary' : 'default'} className="h-7 text-xs" onClick={() => setDetalhe((d) => !d)}>{detalhe ? 'Ocultar' : 'Ver detalhamento do bridge'}</Button>
      </div>
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        <Caixa titulo="Resultado da Operação" valor={bridge.de} sub="(Competência)" cls="bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30" />
        <ArrowRight className="w-5 h-5 self-center shrink-0 text-muted-foreground" />
        {visiveis.length === 0 && <Caixa titulo="Sem ajustes" valor={0} cls="bg-muted" />}
        {visiveis.map((a) => (
          <Caixa key={a.chave} titulo={a.rotulo} valor={a.valor} sinal cls={a.requerLoopR ? 'bg-amber-50 border-amber-200 text-amber-700' : a.valor >= 0 ? 'bg-emerald-50/60 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'} />
        ))}
        <ArrowRight className="w-5 h-5 self-center shrink-0 text-muted-foreground" />
        <Caixa titulo="Resultado de Caixa" valor={bridge.para} sub="(Movimentação)" cls="bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30" />
      </div>
      {detalhe && (
        <table className="w-full text-xs mt-3 border-t">
          <thead><tr className="text-muted-foreground"><th className="text-left py-1.5">Natureza</th><th className="text-right">Competência</th><th className="text-right">Caixa</th><th className="text-right">Ajuste</th></tr></thead>
          <tbody>
            {bridge.ajustes.map((a) => (
              <tr key={a.chave} className="border-t border-border/50">
                <td className="py-1.5">{a.rotulo}{a.observacao && <span className="block text-[10px] text-muted-foreground">{a.observacao}</span>}</td>
                <td className="text-right tabular-nums">{formatCurrency(a.competencia)}</td>
                <td className="text-right tabular-nums">{formatCurrency(a.caixa)}</td>
                <td className={`text-right tabular-nums font-semibold ${a.valor < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(a.valor)}</td>
              </tr>
            ))}
            <tr className="border-t font-bold"><td className="py-1.5">Residual (deve ser zero)</td><td /><td /><td className={`text-right tabular-nums ${bridge.fechado ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(bridge.residual)}</td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function Caixa({ titulo, valor, sub, sinal, cls }) {
  return (
    <div className={`rounded-xl border px-3 py-2 min-w-[150px] flex-1 text-center ${cls}`}>
      <p className="text-sm font-bold tabular-nums">{sinal && valor > 0 ? '+ ' : ''}{formatCurrency(valor)}</p>
      <p className="text-[11px] leading-tight text-foreground/80 mt-0.5">{titulo}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}