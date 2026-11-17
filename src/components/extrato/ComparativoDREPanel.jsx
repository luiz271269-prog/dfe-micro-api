import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, Scale } from 'lucide-react';
import { consolidarDREOperacional } from '@/functions/consolidarDREOperacional';
import { formatCurrency } from '@/lib/formatters';

const abs = (v) => Math.abs(v || 0);

// Mesma estrutura da DRE Operacional (coluna Caixa): linhas, subtotais e lucros
function montarLinhas(t, k) {
  const ext = {
    receita: abs(t.receitas), cmv: abs(t.estoque), das: abs(t.impostos),
    folha: abs(t.folha), despesas: abs(t.despesas), outros: 0,
    prolabore: abs(t.pro_labore), obras: abs(t.obras),
  };
  ext.lucroBruto = ext.receita - ext.cmv - ext.das;
  ext.despOp = ext.folha + ext.despesas + ext.outros + ext.prolabore + ext.obras;
  ext.lucroOp = ext.lucroBruto - ext.despOp;
  return [
    { rotulo: 'Receita Bruta de Vendas', tipo: 'receitas', ext: ext.receita, dre: abs(k.receita_bruta), forte: true },
    { rotulo: '(–) CMV', tipo: 'estoque', ext: ext.cmv, dre: abs(k.cmv), forte: true },
    { rotulo: '(–) Impostos — DAS', tipo: 'impostos', ext: ext.das, dre: abs(k.das), sub: true },
    { rotulo: '= LUCRO BRUTO', ext: ext.lucroBruto, dre: k.lucro_bruto || 0, total: true },
    { rotulo: '(–) Despesas Operacionais', ext: ext.despOp, dre: abs(k.total_despesas_operacionais), forte: true },
    { rotulo: 'Folha de pagamento', tipo: 'folha', ext: ext.folha, dre: abs(k.folha), sub: true },
    { rotulo: 'Despesas adm. e operacionais', tipo: 'despesas', ext: ext.despesas, dre: abs(k.despesas), sub: true },
    { rotulo: 'Outros tributos', ext: ext.outros, dre: abs(k.outros_tributos), sub: true },
    { rotulo: '= LUCRO OPERACIONAL', ext: ext.lucroOp, dre: k.lucro_operacional || 0, total: true },
    { rotulo: 'Pró-labore', tipo: 'pro_labore', ext: ext.prolabore, dre: abs(k.prolabore), sub: true },
    { rotulo: 'Obras e reformas', tipo: 'obras', ext: ext.obras, dre: abs(k.obras), sub: true },
  ];
}

export default function ComparativoDREPanel({ mes, isAnnual, totaisTipo, filterTipo, onTipo }) {
  const modo = isAnnual ? 'ano_civil' : 'mensal';
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['comparativo-dre', mes, modo],
    queryFn: async () => (await consolidarDREOperacional({ mes_referencia: mes, modo_periodo: modo })).data,
  });
  const linhas = montarLinhas(totaisTipo, data?.caixa || {});

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
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-[9px] uppercase font-bold text-muted-foreground bg-muted/20">
            <span>Linha</span><span className="w-[76px] text-right">Extrato</span><span className="w-[76px] text-right">DRE</span>
          </div>
          {linhas.map(l => {
            const diff = l.ext - l.dre;
            const ok = Math.abs(diff) < 0.01;
            const ativo = l.tipo && filterTipo === l.tipo;
            const Comp = l.tipo ? 'button' : 'div';
            const cor = (v) => l.total ? (v < 0 ? 'text-red-600' : 'text-emerald-700') : '';
            return (
              <Comp key={l.rotulo} onClick={l.tipo ? () => onTipo(l.tipo) : undefined} title={l.tipo ? 'Filtrar lançamentos deste tipo' : undefined}
                className={`block w-full text-left px-3 py-2 transition-colors ${l.total ? 'bg-primary/5' : ''} ${ativo ? 'bg-primary/10 ring-1 ring-inset ring-primary' : l.tipo ? 'hover:bg-muted/40' : ''}`}>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-[11px] tabular-nums">
                  <span className={`${l.sub ? 'pl-3 text-muted-foreground' : ''} ${l.total || l.forte ? 'font-bold text-foreground' : ''} truncate`}>{l.rotulo}</span>
                  <span className={`w-[76px] text-right ${l.total ? 'font-bold' : ''} ${cor(l.ext)}`}>{formatCurrency(l.ext)}</span>
                  <span className={`w-[76px] text-right ${l.total ? 'font-bold' : ''} ${cor(l.dre)}`}>{formatCurrency(l.dre)}</span>
                </div>
                {!ok && <p className="mt-0.5 text-right text-[10px] font-semibold text-amber-700">Dif. {formatCurrency(diff)}</p>}
              </Comp>
            );
          })}
        </div>
      )}

      <p className="px-3 py-2.5 border-t bg-muted/20 text-[10px] leading-relaxed text-muted-foreground">
        Mesma estrutura da DRE Caixa. O extrato soma lançamentos pelo tipo de compra; a DRE aplica suas regras de realização (vínculos, faturas de cartão por item, datas de pagamento). Diferenças indicam itens a revisar.{' '}
        <Link to="/dre-operacional" className="font-semibold text-primary hover:underline">Abrir DRE</Link>
      </p>
    </aside>
  );
}