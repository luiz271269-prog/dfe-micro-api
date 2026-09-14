import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getCor } from '@/lib/classificacaoUnificada';
import useCadastroClassificacao from '@/hooks/useCadastroClassificacao';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function Variacao({ v }) {
  if (v === null || v === undefined) return <span className="text-muted-foreground text-xs">—</span>;
  const up = v > 0.02, down = v < -0.02;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const cor = up ? 'text-red-600' : down ? 'text-emerald-600' : 'text-muted-foreground';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${cor}`}>
      <Icon className="w-3.5 h-3.5" />
      {(v * 100).toFixed(0)}%
    </span>
  );
}

export default function TabelaDesempenho({ titulo, eixo, dados }) {
  const { opcoes } = useCadastroClassificacao(eixo);
  const total = dados.reduce((s, d) => s + d.total, 0);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-muted/40">
        <h3 className="text-sm font-semibold">{titulo}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-muted-foreground border-b">
              <th className="text-left font-semibold px-4 py-2">Categoria</th>
              <th className="text-right font-semibold px-3 py-2">Total período</th>
              <th className="text-right font-semibold px-3 py-2">Part.</th>
              <th className="text-right font-semibold px-3 py-2">Média/mês</th>
              <th className="text-right font-semibold px-3 py-2">Último mês</th>
              <th className="text-right font-semibold px-4 py-2">vs mês ant.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {dados.map((d) => (
              <tr key={d.categoria} className="hover:bg-muted/30">
                <td className="px-4 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${getCor(eixo, d.categoria)}`}>
                    {opcoes[d.categoria] || 'Sem classificação'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(d.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {(d.participacao * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmt(d.media)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(d.atual)}</td>
                <td className="px-4 py-2 text-right"><Variacao v={d.variacao} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(total)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}