import { Link } from 'react-router-dom';
import { RefreshCw, Scale } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useDREExtrato, linhaDREDe } from '@/components/extrato/linhasDRE';

const abs = (v) => Math.abs(v || 0);

// Extrato agrupado pela MESMA regra da DRE Caixa (vínculo > tipo de compra > categoria)
function montarLinhas(lancamentos, mapa, k) {
  const s = {};
  lancamentos.forEach(l => { const ln = linhaDREDe(mapa, l.id); s[ln] = (s[ln] || 0) + (l.valor || 0); });
  const e = Object.fromEntries(['receita_bruta', 'cmv', 'das', 'folha', 'despesas', 'outros_tributos', 'prolabore', 'obras'].map(c => [c, abs(s[c])]));
  const lb = e.receita_bruta - e.das - e.cmv;
  const dop = e.folha + e.despesas + e.outros_tributos + e.prolabore + e.obras;
  return [
    { rotulo: 'Receita Bruta de Vendas', linha: 'receita_bruta', ext: e.receita_bruta, dre: abs(k.receita_bruta), forte: true },
    { rotulo: '(–) Impostos — DAS', linha: 'das', ext: e.das, dre: abs(k.das), sub: true },
    { rotulo: '(–) CMV', linha: 'cmv', ext: e.cmv, dre: abs(k.cmv), forte: true },
    { rotulo: '= LUCRO BRUTO', ext: lb, dre: k.lucro_bruto || 0, total: true },
    { rotulo: '(–) Despesas Operacionais', ext: dop, dre: abs(k.total_despesas_operacionais), forte: true },
    { rotulo: 'Folha de pagamento', linha: 'folha', ext: e.folha, dre: abs(k.folha), sub: true },
    { rotulo: 'Despesas adm. e operacionais', linha: 'despesas', ext: e.despesas, dre: abs(k.despesas), sub: true },
    { rotulo: 'Outros tributos', linha: 'outros_tributos', ext: e.outros_tributos, dre: abs(k.outros_tributos), sub: true },
    { rotulo: 'Pró-labore', linha: 'prolabore', ext: e.prolabore, dre: abs(k.prolabore), sub: true },
    { rotulo: 'Obras e reformas', linha: 'obras', ext: e.obras, dre: abs(k.obras), sub: true },
    { rotulo: '= LUCRO OPERACIONAL', ext: lb - dop, dre: k.lucro_operacional || 0, total: true },
    { rotulo: 'Fora da DRE (financeiro, aplicações, pessoal, não classif.)', linha: 'fora', ext: s.fora || 0, dre: null, sub: true },
  ];
}

export default function ComparativoDREPanel({ mes, isAnnual, lancamentos, filtroDRE, onLinha }) {
  const { data, isLoading, isFetching, error, refetch } = useDREExtrato(mes, isAnnual);
  const linhas = montarLinhas(lancamentos, data?.mapa_extrato, data?.caixa || {});

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
            const diff = l.dre == null ? 0 : l.ext - l.dre;
            const ativo = l.linha && filtroDRE === l.linha;
            const Comp = l.linha ? 'button' : 'div';
            const cor = (v) => l.total ? (v < 0 ? 'text-red-600' : 'text-emerald-700') : '';
            return (
              <Comp key={l.rotulo} onClick={l.linha ? () => onLinha(l.linha) : undefined} title={l.linha ? 'Filtrar os lançamentos desta linha da DRE' : undefined}
                className={`block w-full text-left px-3 py-2 transition-colors ${l.total ? 'bg-primary/5' : ''} ${ativo ? 'bg-primary/10 ring-1 ring-inset ring-primary' : l.linha ? 'hover:bg-muted/40' : ''}`}>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-[11px] tabular-nums">
                  <span className={`${l.sub ? 'pl-3 text-muted-foreground' : ''} ${l.total || l.forte ? 'font-bold text-foreground' : ''} truncate`}>{l.rotulo}</span>
                  <span className={`w-[76px] text-right ${l.total ? 'font-bold' : ''} ${cor(l.ext)}`}>{formatCurrency(l.ext)}</span>
                  <span className={`w-[76px] text-right ${l.total ? 'font-bold' : ''} ${cor(l.dre)}`}>{l.dre == null ? '—' : formatCurrency(l.dre)}</span>
                </div>
                {Math.abs(diff) >= 0.01 && <p className="mt-0.5 text-right text-[10px] font-semibold text-amber-700">Dif. {formatCurrency(diff)}</p>}
              </Comp>
            );
          })}
        </div>
      )}

      <p className="px-3 py-2.5 border-t bg-muted/20 text-[10px] leading-relaxed text-muted-foreground">
        O extrato é agrupado pela mesma regra da DRE Caixa: vínculo conciliado prevalece sobre o tipo de compra, que prevalece sobre a categoria (ex.: pagamento de fatura de cartão entra em CMV). Diferenças restantes vêm de lançamentos com mês de referência diferente da data ou marcados para ignorar.{' '}
        <Link to="/dre-operacional" className="font-semibold text-primary hover:underline">Abrir DRE</Link>
      </p>
    </aside>
  );
}