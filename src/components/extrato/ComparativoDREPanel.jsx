import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, Scale } from 'lucide-react';
import { consolidarDREOperacional } from '@/functions/consolidarDREOperacional';
import { formatCurrency } from '@/lib/formatters';

// Tipos do extrato (tipo_compra) → linhas da DRE Caixa
const LINHAS = [
  { rotulo: 'Receitas', tipos: ['receitas'], dre: ['receita_bruta'] },
  { rotulo: 'Compras / CMV', tipos: ['estoque'], dre: ['cmv'] },
  { rotulo: 'Impostos (DAS + outros)', tipos: ['impostos'], dre: ['das', 'outros_tributos'] },
  { rotulo: 'Folha', tipos: ['folha'], dre: ['folha'] },
  { rotulo: 'Despesas', tipos: ['despesas'], dre: ['despesas'] },
  { rotulo: 'Pró-labore', tipos: ['pro_labore'], dre: ['prolabore'] },
  { rotulo: 'Obras / Reformas', tipos: ['obras'], dre: ['obras'] },
];

export default function ComparativoDREPanel({ mes, isAnnual, totaisTipo }) {
  const modo = isAnnual ? 'ano_civil' : 'mensal';
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['comparativo-dre', mes, modo],
    queryFn: async () => (await consolidarDREOperacional({ mes_referencia: mes, modo_periodo: modo })).data,
  });
  const caixa = data?.caixa;

  return (
    <aside className="bg-card border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          <p className="text-sm font-bold">Extrato × DRE Caixa</p>
        </div>
        <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground" title="Atualizar">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="p-6 flex justify-center"><div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : error ? (
        <p className="p-3 text-xs text-destructive">Não foi possível ler a DRE: {error.message}</p>
      ) : (
        <div className="divide-y">
          {LINHAS.map(l => {
            const ext = Math.abs(l.tipos.reduce((s, t) => s + (totaisTipo[t] || 0), 0));
            const dre = Math.abs(l.dre.reduce((s, c) => s + (caixa?.[c] || 0), 0));
            const diff = ext - dre;
            const ok = Math.abs(diff) < 0.01;
            return (
              <div key={l.rotulo} className="px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">{l.rotulo}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {ok ? 'igual' : 'revisar'}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] tabular-nums">
                  <div><p className="text-muted-foreground text-[9px] uppercase">Extrato</p>{formatCurrency(ext)}</div>
                  <div><p className="text-muted-foreground text-[9px] uppercase">DRE</p>{formatCurrency(dre)}</div>
                  <div className={ok ? 'text-muted-foreground' : 'text-amber-700 font-semibold'}><p className="text-muted-foreground text-[9px] uppercase font-normal">Dif.</p>{formatCurrency(diff)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="px-3 py-2.5 border-t bg-muted/20 text-[10px] leading-relaxed text-muted-foreground">
        O extrato soma lançamentos pelo tipo de compra. A DRE Caixa aplica suas regras de realização (vínculos, faturas de cartão por item, datas de pagamento). Diferenças indicam itens a revisar, não erro automático.{' '}
        <Link to="/dre-operacional" className="font-semibold text-primary hover:underline">Abrir DRE</Link>
      </p>
    </aside>
  );
}