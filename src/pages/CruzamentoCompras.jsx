import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '../lib/formatters';
import PageHeader from '../components/shared/PageHeader';
import { ShoppingCart, Landmark, CreditCard, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MatchingCompraPagamento from '../components/cruzamento/MatchingCompraPagamento';

const ALL_MONTHS = ['2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];

function fmtMes(m) {
  const [y, mo] = m.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(mo)-1]}/${y.slice(2)}`;
}

// Normaliza string para comparação (remove acentos, minúscula, espaços extras)
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

// Verifica se dois nomes são do mesmo fornecedor (match parcial)
function matchFornecedor(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  // Match exato
  if (na === nb) return true;
  // Um contém o outro (min 5 chars)
  const shorter = na.length < nb.length ? na : nb;
  const longer  = na.length < nb.length ? nb : na;
  if (shorter.length >= 5 && longer.includes(shorter)) return true;
  // Primeira palavra significativa (min 4 chars)
  const wordA = na.split(' ').find(w => w.length >= 4);
  const wordB = nb.split(' ').find(w => w.length >= 4);
  if (wordA && wordB && (na.includes(wordB) || nb.includes(wordA))) return true;
  return false;
}

function Badge({ color, children }) {
  const map = {
    green:  'bg-emerald-100 text-emerald-700 border-emerald-200',
    red:    'bg-red-100 text-red-700 border-red-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    blue:   'bg-blue-100 text-blue-700 border-blue-200',
    gray:   'bg-slate-100 text-slate-600 border-slate-200',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${map[color]}`}>{children}</span>;
}

export default function CruzamentoCompras() {
  const [selectedMonth, setSelectedMonth] = useState('2026-04');
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [compras, setCompras] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [lancCartao, setLancCartao] = useState([]);
  const [expandedForn, setExpandedForn] = useState(null);

  async function load() {
    const [c, l, lc] = await Promise.all([
      base44.entities.ItemCompra.list('-data_emissao', 1000),
      base44.entities.LancamentoBancario.list('-data', 1000),
      base44.entities.LancamentoCartao.list('-data_lancamento', 1000),
    ]);
    setCompras(Array.isArray(c) ? c : []);
    setLancamentos(Array.isArray(l) ? l : []);
    setLancCartao(Array.isArray(lc) ? lc : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Compras filtradas para a aba matching
  const comprasFiltradas = useMemo(() => {
    if (isAnnual) return compras;
    const inicio = selectedMonth + '-01';
    const fim = selectedMonth + '-31';
    return compras.filter(c => (c.data_emissao || '') >= inicio && (c.data_emissao || '') <= fim);
  }, [compras, selectedMonth, isAnnual]);

  const analysis = useMemo(() => {
    const inicio = selectedMonth + '-01';
    const fim    = selectedMonth + '-31';

    const comprasF = isAnnual ? compras : compras.filter(c => (c.data_emissao || '') >= inicio && (c.data_emissao || '') <= fim);

    // Agrupar compras por fornecedor
    const fornMap = {};
    for (const c of comprasF) {
      const f = (c.fornecedor || 'Sem fornecedor').trim();
      if (!fornMap[f]) fornMap[f] = { fornecedor: f, itens: [], totalComprado: 0 };
      fornMap[f].itens.push(c);
      fornMap[f].totalComprado += (c.valor_total || 0);
    }

    // Pagamentos bancários do período (categoria fornecedor/despesa_operacional)
    const pagBanco = isAnnual ? lancamentos.filter(l => l.valor < 0 && ['fornecedor','despesa_operacional','financeiro'].includes(l.categoria))
      : lancamentos.filter(l => (l.data||'') >= inicio && (l.data||'') <= fim && l.valor < 0 && ['fornecedor','despesa_operacional','financeiro'].includes(l.categoria));

    // Pagamentos cartão do período
    const pagCartao = isAnnual ? lancCartao
      : lancCartao.filter(l => (l.data_lancamento||'') >= inicio && (l.data_lancamento||'') <= fim);

    // Para cada fornecedor, encontrar pagamentos correspondentes
    const rows = Object.values(fornMap).map(forn => {
      const pagBancoMatch = pagBanco.filter(l => matchFornecedor(forn.fornecedor, l.descricao));
      const pagCartaoMatch = pagCartao.filter(l => matchFornecedor(forn.fornecedor, l.estabelecimento));

      const totalBanco  = pagBancoMatch.reduce((s, l) => s + Math.abs(l.valor || 0), 0);
      const totalCartao = pagCartaoMatch.reduce((s, l) => s + Math.abs(l.valor || 0), 0);
      const totalPago   = totalBanco + totalCartao;
      const diferenca   = forn.totalComprado - totalPago;
      const status = totalPago === 0 ? 'sem_pagamento'
        : Math.abs(diferenca) < 1 ? 'quitado'
        : diferenca > 0 ? 'parcial'
        : 'excesso';

      return { ...forn, totalBanco, totalCartao, totalPago, diferenca, status, pagBancoMatch, pagCartaoMatch };
    });

    rows.sort((a, b) => b.totalComprado - a.totalComprado);

    // Totais gerais
    const totalComprado = rows.reduce((s, r) => s + r.totalComprado, 0);
    const totalPago     = rows.reduce((s, r) => s + r.totalPago, 0);
    const semPag        = rows.filter(r => r.status === 'sem_pagamento').length;
    const parcial       = rows.filter(r => r.status === 'parcial').length;

    return { rows, totalComprado, totalPago, semPag, parcial };
  }, [compras, lancamentos, lancCartao, selectedMonth, isAnnual]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const { rows, totalComprado, totalPago, semPag, parcial } = analysis;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="Cruzamento Compras × Pagamentos" subtitle="Conciliação entre compras importadas e pagamentos (banco + cartão)" />

      {/* Filtro de mês */}
      <div className="flex items-center gap-1.5 flex-wrap mb-6">
        {ALL_MONTHS.slice(-5).map(m => (
          <button key={m} onClick={() => { setSelectedMonth(m); setIsAnnual(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!isAnnual && selectedMonth === m ? 'bg-blue-600 text-white shadow' : 'border hover:bg-muted text-muted-foreground'}`}>
            {fmtMes(m)}
          </button>
        ))}
        <button onClick={() => setIsAnnual(!isAnnual)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold ml-1 transition-all ${isAnnual ? 'bg-blue-600 text-white shadow' : 'border hover:bg-muted text-muted-foreground'}`}>
          Anual
        </button>
      </div>

      <Tabs defaultValue="matching" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="matching" className="gap-2"><CheckCircle className="w-4 h-4" /> Matching item-a-item</TabsTrigger>
          <TabsTrigger value="fornecedor" className="gap-2"><ShoppingCart className="w-4 h-4" /> Visão por fornecedor</TabsTrigger>
        </TabsList>

        <TabsContent value="matching">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-3">
            <p className="text-xs text-indigo-900 leading-relaxed">
              <strong>Evita dupla contagem:</strong> cada compra deve estar vinculada ao pagamento correspondente (cartão ou banco).
              Use "Auto-vincular alta confiança" para processar em lote matches com valor+data+fornecedor perfeitos.
            </p>
          </div>
          <MatchingCompraPagamento
            compras={comprasFiltradas}
            lancamentosBanco={lancamentos}
            lancamentosCartao={lancCartao}
            onRefresh={load}
          />
        </TabsContent>

        <TabsContent value="fornecedor">

      {/* Cards resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-orange-500" />
            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Comprado</p>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalComprado)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{rows.length} fornecedores</p>
        </div>
        <div className="bg-white dark:bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-semibold text-muted-foreground uppercase">Pago via Banco</p>
          </div>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(rows.reduce((s, r) => s + r.totalBanco, 0))}</p>
        </div>
        <div className="bg-white dark:bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-purple-500" />
            <p className="text-xs font-semibold text-muted-foreground uppercase">Pago via Cartão</p>
          </div>
          <p className="text-xl font-bold text-purple-600">{formatCurrency(rows.reduce((s, r) => s + r.totalCartao, 0))}</p>
        </div>
        <div className="bg-white dark:bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-xs font-semibold text-muted-foreground uppercase">Sem Pagamento</p>
          </div>
          <p className="text-xl font-bold text-red-600">{semPag}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{parcial} parciais</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Fornecedor</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Comprado</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Banco</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Cartão</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Diferença</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
              <th className="px-2 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <>
                <tr key={row.fornecedor} className={`border-b hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <td className="px-4 py-3 font-semibold text-sm">{row.fornecedor}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(row.totalComprado)}</td>
                  <td className="px-4 py-3 text-right text-blue-600 hidden sm:table-cell">{row.totalBanco > 0 ? formatCurrency(row.totalBanco) : '—'}</td>
                  <td className="px-4 py-3 text-right text-purple-600 hidden sm:table-cell">{row.totalCartao > 0 ? formatCurrency(row.totalCartao) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={Math.abs(row.diferenca) < 1 ? 'text-emerald-600 font-bold' : row.diferenca > 0 ? 'text-orange-600 font-bold' : 'text-blue-600 font-bold'}>
                      {Math.abs(row.diferenca) < 1 ? '✓' : formatCurrency(Math.abs(row.diferenca))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.status === 'quitado'      && <Badge color="green">Quitado</Badge>}
                    {row.status === 'sem_pagamento' && <Badge color="red">Sem pagamento</Badge>}
                    {row.status === 'parcial'       && <Badge color="orange">Parcial</Badge>}
                    {row.status === 'excesso'       && <Badge color="blue">Excesso</Badge>}
                  </td>
                  <td className="px-2 py-3">
                    {(row.pagBancoMatch.length > 0 || row.pagCartaoMatch.length > 0) && (
                      <button onClick={() => setExpandedForn(expandedForn === row.fornecedor ? null : row.fornecedor)}
                        className="text-muted-foreground hover:text-foreground">
                        {expandedForn === row.fornecedor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedForn === row.fornecedor && (
                  <tr key={row.fornecedor + '_detail'} className="border-b bg-muted/20">
                    <td colSpan={7} className="px-6 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Itens comprados */}
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> Itens comprados</p>
                          <div className="space-y-1">
                            {row.itens.map((it, j) => (
                              <div key={j} className="flex justify-between text-xs">
                                <span className="text-foreground/80 truncate max-w-[200px]">{it.descricao_produto} {it.quantidade > 1 ? `(×${it.quantidade})` : ''}</span>
                                <span className="font-semibold ml-2 shrink-0">{formatCurrency(it.valor_total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Pagamentos encontrados */}
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Pagamentos encontrados</p>
                          <div className="space-y-1">
                            {row.pagBancoMatch.map((p, j) => (
                              <div key={'b'+j} className="flex justify-between text-xs">
                                <span className="text-blue-700 flex items-center gap-1"><Landmark className="w-3 h-3" />{p.descricao?.slice(0, 35)}</span>
                                <span className="font-semibold ml-2 shrink-0">{formatCurrency(Math.abs(p.valor))}</span>
                              </div>
                            ))}
                            {row.pagCartaoMatch.map((p, j) => (
                              <div key={'c'+j} className="flex justify-between text-xs">
                                <span className="text-purple-700 flex items-center gap-1"><CreditCard className="w-3 h-3" />{p.estabelecimento?.slice(0, 35)}</span>
                                <span className="font-semibold ml-2 shrink-0">{formatCurrency(Math.abs(p.valor))}</span>
                              </div>
                            ))}
                            {row.pagBancoMatch.length === 0 && row.pagCartaoMatch.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">Nenhum pagamento localizado</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t-2">
              <td className="px-4 py-3 font-bold text-sm">Total</td>
              <td className="px-4 py-3 text-right font-bold">{formatCurrency(totalComprado)}</td>
              <td className="px-4 py-3 text-right font-bold text-blue-600 hidden sm:table-cell">{formatCurrency(rows.reduce((s,r)=>s+r.totalBanco,0))}</td>
              <td className="px-4 py-3 text-right font-bold text-purple-600 hidden sm:table-cell">{formatCurrency(rows.reduce((s,r)=>s+r.totalCartao,0))}</td>
              <td className="px-4 py-3 text-right font-bold">{formatCurrency(Math.abs(totalComprado - totalPago))}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
        {rows.length === 0 && (
          <div className="p-12 text-center text-muted-foreground text-sm">Nenhuma compra encontrada no período selecionado.</div>
        )}
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}