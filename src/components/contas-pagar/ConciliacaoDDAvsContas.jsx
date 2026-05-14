import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Zap, AlertTriangle, CheckCircle, FileText, Wallet, RefreshCw, Link2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';
import {
  consolidarContasPagar,
  acharContaPagarPorLancamento,
  executarBaixaAutomatica,
} from '../../lib/contasPagarEngine';

const ORIGEM_LABEL = {
  despesa: 'Despesa', tributo: 'Tributo', folha: 'Folha', fatura: 'Cartão',
};
const ORIGEM_COLOR = {
  despesa: 'bg-emerald-100 text-emerald-700',
  tributo: 'bg-orange-100 text-orange-700',
  folha:   'bg-indigo-100 text-indigo-700',
  fatura:  'bg-purple-100 text-purple-700',
};

export default function ConciliacaoDDAvsContas({ selectedMonth, isAnnual }) {
  const [loading, setLoading] = useState(true);
  const [conciliando, setConciliando] = useState(false);
  const [resultadoBaixa, setResultadoBaixa] = useState(null);
  const [lancamentos, setLancamentos] = useState([]);
  const [dados, setDados] = useState({ despesas: [], tributos: [], folhas: [], faturas: [], cartoes: [] });
  const [searchDDA, setSearchDDA] = useState('');
  const [searchCP, setSearchCP] = useState('');
  const [selectedDDA, setSelectedDDA] = useState(null);

  async function load() {
    setLoading(true);
    const [despesas, tributos, folhas, faturas, cartoes, lancs] = await Promise.all([
      base44.entities.DespesaOperacional.list('-data_vencimento', 500),
      base44.entities.Tributo.list('-data_vencimento', 200),
      base44.entities.FolhaPagamento.list('-competencia', 500),
      base44.entities.FaturaCartao.list('-data_vencimento', 200),
      base44.entities.ContaCartao.filter({ is_ativo: true }),
      base44.entities.LancamentoBancario.list('-data', 1000),
    ]);
    setDados({ despesas, tributos, folhas, faturas, cartoes });
    setLancamentos(lancs);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('neuralfinRefresh', handler);
    return () => window.removeEventListener('neuralfinRefresh', handler);
  }, []);

  async function executarBaixa() {
    if (conciliando) return;
    setConciliando(true);
    setResultadoBaixa(null);
    try {
      const res = await executarBaixaAutomatica(base44, dados);
      setResultadoBaixa(res);
      await load();
      window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (err) {
      setResultadoBaixa({ erro: err.message });
    }
    setConciliando(false);
  }

  // DDA = lançamentos bancários futuros (boletos a vencer pelo banco)
  const hoje = new Date().toISOString().slice(0, 10);
  const ddaItems = useMemo(() => {
    return lancamentos.filter(l => {
      const mes = l.mes_referencia || (l.data || '').slice(0, 7);
      const isFuturo = l.data >= hoje;
      const mesMatch = isAnnual ? true : mes === selectedMonth;
      if (!isFuturo || !mesMatch) return false;
      if (l.categoria === 'transferencia' || l.categoria === 'interno') return false;
      if (searchDDA && !l.descricao?.toLowerCase().includes(searchDDA.toLowerCase())) return false;
      return true;
    }).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }, [lancamentos, selectedMonth, isAnnual, searchDDA, hoje]);

  // Contas a Pagar = obrigações lançadas no sistema (despesas/tributos/folha/fatura em aberto)
  const contasPagar = useMemo(() => consolidarContasPagar(dados), [dados]);
  const contasPagarFiltradas = useMemo(() => {
    return contasPagar.filter(c => {
      if (!isAnnual) {
        const mes = (c.data_vencimento || '').slice(0, 7);
        if (mes !== selectedMonth) return false;
      }
      if (searchCP && !c.descricao?.toLowerCase().includes(searchCP.toLowerCase())
        && !c.fornecedor?.toLowerCase().includes(searchCP.toLowerCase())) return false;
      return true;
    }).sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''));
  }, [contasPagar, selectedMonth, isAnnual, searchCP]);

  // Match: para cada DDA, tenta encontrar uma conta a pagar correspondente
  const matchMap = useMemo(() => {
    const m = new Map();
    ddaItems.forEach(dda => {
      const match = acharContaPagarPorLancamento(dda, contasPagar);
      if (match) m.set(dda.id, match);
    });
    return m;
  }, [ddaItems, contasPagar]);

  // Set inverso: contas a pagar que têm DDA correspondente
  const contasComDDA = useMemo(() => {
    const s = new Set();
    matchMap.forEach(c => s.add(c.id));
    return s;
  }, [matchMap]);

  const totalDDA = ddaItems.reduce((s, l) => s + Math.abs(l.valor || 0), 0);
  const totalCP = contasPagarFiltradas.reduce((s, c) => s + (c.valor || 0), 0);
  const totalConciliado = ddaItems.filter(d => matchMap.has(d.id)).reduce((s, l) => s + Math.abs(l.valor || 0), 0);

  return (
    <>
      {/* Header de ações */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="text-xs text-muted-foreground">
          <span className="font-bold text-foreground">{matchMap.size}</span> de {ddaItems.length} DDA conciliados ·
          <span className="font-bold text-foreground"> {formatCurrency(totalConciliado)}</span> casados
        </div>
        <div className="flex gap-2">
          <Button onClick={executarBaixa} disabled={conciliando} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {conciliando
              ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Conciliando...</>
              : <><Zap className="w-3.5 h-3.5" /> Baixa Automática</>}
          </Button>
          <Button variant="outline" onClick={load} size="sm" className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</Button>
        </div>
      </div>

      {resultadoBaixa && (
        <div className={`rounded-xl p-3 mb-4 border ${resultadoBaixa.erro ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {resultadoBaixa.erro ? (
            <div className="flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4" /> Erro: {resultadoBaixa.erro}</div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span className="font-semibold">{resultadoBaixa.conciliados} conta(s) baixada(s) automaticamente</span>
                <span className="text-xs opacity-80">· {resultadoBaixa.totalLancamentos} débitos analisados · {resultadoBaixa.totalContas} contas em aberto</span>
              </div>
              <button onClick={() => setResultadoBaixa(null)} className="text-xs opacity-70 hover:opacity-100">×</button>
            </div>
          )}
        </div>
      )}

      {/* Duas colunas lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* COLUNA DDA */}
        <div className="bg-card rounded-xl border overflow-hidden flex flex-col">
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm flex items-center gap-2 text-orange-800">
                <FileText className="w-4 h-4" /> DDA — Boletos a Vencer (Banco)
              </h3>
              <span className="text-xs font-bold text-orange-700">{formatCurrency(totalDDA)}</span>
            </div>
            <p className="text-[11px] text-orange-700/80">Registrados pelos credores no banco — {ddaItems.length} item(ns)</p>
          </div>
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Buscar no DDA..." value={searchDDA} onChange={e => setSearchDDA(e.target.value)} className="pl-9 h-8 text-xs" />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {loading ? <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
              : ddaItems.length === 0 ? <div className="text-center py-12 text-muted-foreground text-sm">Nenhum boleto a vencer</div>
              : ddaItems.map(dda => {
                const match = matchMap.get(dda.id);
                const isSelected = selectedDDA === dda.id;
                return (
                  <button key={dda.id}
                    onClick={() => setSelectedDDA(isSelected ? null : dda.id)}
                    className={`w-full text-left px-3 py-2 border-b hover:bg-muted/30 transition-colors ${isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : ''} ${match ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-transparent'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{dda.descricao}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{formatDate(dda.data)}</span>
                          {dda.detalhe && <span className="truncate">· {dda.detalhe}</span>}
                        </div>
                        {match && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-700">
                            <Link2 className="w-3 h-3" />
                            <span className="font-semibold">Casa com:</span>
                            <span className="truncate">{match.descricao}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-bold text-rose-600 tabular-nums whitespace-nowrap">{formatCurrency(Math.abs(dda.valor))}</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* COLUNA CONTAS A PAGAR */}
        <div className="bg-card rounded-xl border overflow-hidden flex flex-col">
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm flex items-center gap-2 text-blue-800">
                <Wallet className="w-4 h-4" /> Contas a Pagar (Sistema)
              </h3>
              <span className="text-xs font-bold text-blue-700">{formatCurrency(totalCP)}</span>
            </div>
            <p className="text-[11px] text-blue-700/80">Lançadas no sistema — despesas, tributos, folha, faturas — {contasPagarFiltradas.length} item(ns)</p>
          </div>
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Buscar nas contas..." value={searchCP} onChange={e => setSearchCP(e.target.value)} className="pl-9 h-8 text-xs" />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {loading ? <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
              : contasPagarFiltradas.length === 0 ? <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma conta em aberto</div>
              : contasPagarFiltradas.map(c => {
                const temDDA = contasComDDA.has(c.id);
                // Highlight se o DDA selecionado casa com esta conta
                const selectedMatch = selectedDDA ? matchMap.get(selectedDDA) : null;
                const isHighlighted = selectedMatch && selectedMatch.id === c.id;
                return (
                  <div key={c.id}
                    className={`px-3 py-2 border-b hover:bg-muted/30 transition-colors ${isHighlighted ? 'bg-blue-100 ring-1 ring-blue-400' : ''} ${temDDA ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-amber-300'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ORIGEM_COLOR[c.origem_tipo]}`}>
                            {ORIGEM_LABEL[c.origem_tipo]}
                          </span>
                          {temDDA
                            ? <span className="text-[9px] font-bold text-emerald-700 flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5" /> No DDA</span>
                            : <span className="text-[9px] font-bold text-amber-700 flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Sem DDA</span>}
                        </div>
                        <p className="text-xs font-medium truncate">{c.descricao}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span>Venc {c.data_vencimento ? formatDate(c.data_vencimento) : '—'}</span>
                          <span className="truncate">· {c.fornecedor}</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-rose-600 tabular-nums whitespace-nowrap">{formatCurrency(c.valor)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-400" /> Conciliado (DDA × Conta)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-amber-300" /> Sem correspondência no DDA</span>
        <span className="flex items-center gap-1.5">Clique num DDA para destacar a conta correspondente</span>
      </div>
    </>
  );
}