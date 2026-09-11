import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, ShoppingCart, TrendingDown, Building2, Receipt, AlertTriangle, CheckCircle, FileText, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator, { ALL_MONTHS } from '../components/shared/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/shared/PageHeader';
import IntegradosModuloPanel from '@/components/integracoes/IntegradosModuloPanel';
import StatusBadge from '../components/shared/StatusBadge';
import SortableTh from '../components/shared/SortableTh';
import useTableSort from '@/hooks/useTableSort';
import { formatCurrency, formatDate, categoriaLabels } from '../lib/formatters';
import { getCurrentMonth } from '../lib/currentMonth';
import ConciliacaoDDAvsContas from '../components/contas-pagar/ConciliacaoDDAvsContas';

// ── Compras config ────────────────────────────────────────────────────────────
const fornecedorOptions = ['COMPRAS A VISTA', 'MERCADO LIVRE', 'PAUTA DISTRIBUIÇÃO'];
const categoriaComprasOptions = ['notebook','tablet','smartphone','componente','memoria','armazenamento','periferico','software','rede','outro'];
const categoriaComprasColors = {
  notebook:'bg-blue-100 text-blue-700',tablet:'bg-purple-100 text-purple-700',
  smartphone:'bg-green-100 text-green-700',componente:'bg-orange-100 text-orange-700',
  memoria:'bg-yellow-100 text-yellow-700',armazenamento:'bg-cyan-100 text-cyan-700',
  periferico:'bg-pink-100 text-pink-700',software:'bg-indigo-100 text-indigo-700',
  rede:'bg-teal-100 text-teal-700',outro:'bg-slate-100 text-slate-700',
};

// ── Despesas config ───────────────────────────────────────────────────────────
const CATEGORIAS_DESP = ['aluguel','energia','agua','internet','telefone','manutencao','limpeza','marketing','contabilidade','juridico','seguro','transporte','alimentacao','material_escritorio','outro'];
const FORMAS_PAG = ['pix','boleto','cartao','debito_automatico','dinheiro','transferencia'];
const EMPRESAS = ['NeuralTec','Liesch'];
const categoriaDesepColors = {
  aluguel:'bg-blue-100 text-blue-700',energia:'bg-yellow-100 text-yellow-700',
  agua:'bg-cyan-100 text-cyan-700',internet:'bg-indigo-100 text-indigo-700',
  telefone:'bg-purple-100 text-purple-700',manutencao:'bg-orange-100 text-orange-700',
  limpeza:'bg-teal-100 text-teal-700',marketing:'bg-pink-100 text-pink-700',
  contabilidade:'bg-green-100 text-green-700',juridico:'bg-red-100 text-red-700',
  seguro:'bg-slate-100 text-slate-700',transporte:'bg-amber-100 text-amber-700',
  alimentacao:'bg-lime-100 text-lime-700',material_escritorio:'bg-violet-100 text-violet-700',
  outro:'bg-slate-100 text-slate-600',
};
const EMPTY_DESP = { data:'',descricao:'',fornecedor:'',categoria:'aluguel',valor:'',forma_pagamento:'pix',status:'pago',data_vencimento:'',empresa:'NeuralTec',recorrente:false,observacoes:'' };

const TABS = [
  { key: 'compras', label: 'Compras', icon: ShoppingCart },
  { key: 'despesas', label: 'Despesas', icon: Receipt },
  { key: 'conciliacao', label: 'DDA × Contas a Pagar', icon: Wallet },
];

export default function Compras() {
  const [activeTab, setActiveTab] = useState('compras');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isAnnual, setIsAnnual] = useState(false);

  // ── Compras state ─────────────────────────────────────────────────────────
  const [compras, setCompras] = useState([]);
  const [loadingC, setLoadingC] = useState(true);
  const [showFormC, setShowFormC] = useState(false);
  const [filterFornecedor, setFilterFornecedor] = useState('all');
  const [filterCategoriaC, setFilterCategoriaC] = useState('all');
  const [searchC, setSearchC] = useState('');
  const [fornecedores, setFornecedores] = useState([]);
  const [fornInput, setFornInput] = useState('COMPRAS A VISTA');
  const [showFornSugg, setShowFornSugg] = useState(false);
  const [formC, setFormC] = useState({ fornecedor:'COMPRAS A VISTA',numero_nota:'',data_emissao:'',descricao_produto:'',categoria_produto:'notebook',quantidade:'1',valor_unitario:'',valor_total:'',codigo_produto:'' });

  // ── Despesas state ────────────────────────────────────────────────────────
  const [despesas, setDespesas] = useState([]);
  const [loadingD, setLoadingD] = useState(true);
  const [showFormD, setShowFormD] = useState(false);
  const [filterCategoriaD, setFilterCategoriaD] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchD, setSearchD] = useState('');
  const [formD, setFormD] = useState(EMPTY_DESP);

  // ── DDA state ─────────────────────────────────────────────────────────────
  const [lancamentos, setLancamentos] = useState([]);
  const [loadingL, setLoadingL] = useState(true);
  const [searchDDA, setSearchDDA] = useState('');

  // ── Data loading ─────────────────────────────────────────────────────────
  async function loadCompras() {
    setLoadingC(true);
    const [data, forns] = await Promise.all([
      base44.entities.ItemCompra.list('-data_emissao', 500),
      base44.entities.Fornecedor.list('nome', 200),
    ]);
    setCompras(data.filter(c => !c.tipo_compra || c.tipo_compra === 'estoque')); setFornecedores(forns); setLoadingC(false);
  }
  async function loadDespesas() {
    setLoadingD(true);
    const data = await base44.entities.DespesaOperacional.list('-data', 500);
    setDespesas(Array.isArray(data) ? data.filter(d => !d.tipo_compra || d.tipo_compra === 'despesas') : []); setLoadingD(false);
  }
  async function loadLancamentos() {
    setLoadingL(true);
    const data = await base44.entities.LancamentoBancario.list('-data', 1000);
    setLancamentos(data); setLoadingL(false);
  }

  useEffect(() => {
    loadCompras(); loadDespesas(); loadLancamentos();
    const unsub1 = base44.entities.ItemCompra.subscribe(() => loadCompras());
    const unsub2 = base44.entities.DespesaOperacional.subscribe(() => loadDespesas());
    const unsub3 = base44.entities.LancamentoBancario.subscribe(() => loadLancamentos());
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // ── Compras memos ─────────────────────────────────────────────────────────
  const monthTotalsC = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach(m => { t[m] = compras.filter(c => c.data_emissao?.startsWith(m)).reduce((s,c) => s+(c.valor_total||0), 0); });
    return t;
  }, [compras]);

  const comprasMes = useMemo(() => isAnnual ? compras : compras.filter(c => c.data_emissao?.startsWith(selectedMonth)), [compras, selectedMonth, isAnnual]);
  const filteredC = useMemo(() => comprasMes.filter(c => {
    if (filterFornecedor !== 'all' && c.fornecedor !== filterFornecedor) return false;
    if (filterCategoriaC !== 'all' && c.categoria_produto !== filterCategoriaC) return false;
    if (searchC && !c.descricao_produto?.toLowerCase().includes(searchC.toLowerCase())) return false;
    return true;
  }), [comprasMes, filterFornecedor, filterCategoriaC, searchC]);

  const sortC = useTableSort(filteredC, 'data_emissao', 'desc');

  const totaisFornecedor = useMemo(() => { const t={}; comprasMes.forEach(c => { t[c.fornecedor]=(t[c.fornecedor]||0)+(c.valor_total||0); }); return t; }, [comprasMes]);
  const grandTotalC = comprasMes.reduce((s,c) => s+(c.valor_total||0), 0);

  const fornSuggestions = useMemo(() => {
    const todos = [...fornecedores.map(f=>f.nome), ...fornecedorOptions.filter(f=>!fornecedores.some(fdb=>fdb.nome===f))];
    if (!fornInput) return todos;
    return todos.filter(f => f.toLowerCase().includes(fornInput.toLowerCase()));
  }, [fornecedores, fornInput]);

  // ── Despesas memos ────────────────────────────────────────────────────────
  const monthTotalsD = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach(m => { t[m] = despesas.filter(d => d.data?.startsWith(m)).reduce((s,d) => s+(d.valor||0), 0); });
    return t;
  }, [despesas]);

  const despesasMes = useMemo(() => isAnnual ? despesas : despesas.filter(d => d.data?.startsWith(selectedMonth)), [despesas, selectedMonth, isAnnual]);
  const filteredD = useMemo(() => despesasMes.filter(d => {
    if (filterCategoriaD !== 'all' && d.categoria !== filterCategoriaD) return false;
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (searchD && !d.descricao?.toLowerCase().includes(searchD.toLowerCase()) && !d.fornecedor?.toLowerCase().includes(searchD.toLowerCase())) return false;
    return true;
  }), [despesasMes, filterCategoriaD, filterStatus, searchD]);

  const sortD = useTableSort(filteredD, 'data', 'desc');

  const totalMesD = despesasMes.reduce((s,d) => s+(d.valor||0), 0);
  const totalPago = despesasMes.filter(d=>d.status==='pago').reduce((s,d) => s+(d.valor||0), 0);
  const totalPendente = despesasMes.filter(d=>d.status!=='pago').reduce((s,d) => s+(d.valor||0), 0);
  const porCategoria = useMemo(() => { const t={}; despesasMes.forEach(d => {t[d.categoria]=(t[d.categoria]||0)+(d.valor||0);}); return Object.entries(t).sort((a,b)=>b[1]-a[1]).slice(0,5); }, [despesasMes]);

  // ── DDA memos ─────────────────────────────────────────────────────────────
  const hoje = '2026-04-13';
  const ddaItems = useMemo(() => {
    return lancamentos.filter(l => {
      const mes = l.mes_referencia || (l.data||'').slice(0,7);
      const isFuturo = l.data > hoje;
      const mesMatch = isAnnual ? true : mes === selectedMonth;
      if (!isFuturo || !mesMatch) return false;
      if (searchDDA && !l.descricao?.toLowerCase().includes(searchDDA.toLowerCase())) return false;
      return true;
    });
  }, [lancamentos, selectedMonth, isAnnual, searchDDA]);

  const totalDDA = ddaItems.reduce((s,l) => s+(l.valor||0), 0);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSubmitC(e) {
    e.preventDefault();
    await base44.entities.ItemCompra.create({ ...formC, fornecedor: fornInput||formC.fornecedor, quantidade: parseInt(formC.quantidade)||1, valor_unitario: formC.valor_unitario ? parseFloat(formC.valor_unitario) : null, valor_total: parseFloat(formC.valor_total) });
    setShowFormC(false);
    setFornInput('COMPRAS A VISTA');
    setFormC({ fornecedor:'COMPRAS A VISTA',numero_nota:'',data_emissao:'',descricao_produto:'',categoria_produto:'notebook',quantidade:'1',valor_unitario:'',valor_total:'',codigo_produto:'' });
    loadCompras();
  }

  async function handleSubmitD(e) {
    e.preventDefault();
    await base44.entities.DespesaOperacional.create({ ...formD, valor: parseFloat(formD.valor) });
    setShowFormD(false); setFormD(EMPTY_DESP); loadDespesas();
  }

  // ── Shared month totals (combine compras + despesas for navigator) ─────────
  const monthTotalsActive = activeTab === 'compras' ? monthTotalsC : activeTab === 'despesas' ? monthTotalsD : {};

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Compras & Despesas" subtitle="Gestão de aquisições, despesas operacionais e boletos a vencer">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotalsActive}
        />
        {activeTab === 'compras' && (
          <>
            <Link to="/produtos?tab=fornecedores">
              <Button variant="outline" className="gap-2"><Building2 className="w-4 h-4" /> Fornecedores</Button>
            </Link>
            <Button onClick={() => setShowFormC(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Compra</Button>
          </>
        )}
        {activeTab === 'despesas' && (
          <Button onClick={() => setShowFormD(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Despesa</Button>
        )}
      </PageHeader>

      <IntegradosModuloPanel modulo="comprasDespesas" titulo="Despesas de locações e condomínio" />

      {/* Tabs */}
      <div className="flex border-b mb-6 gap-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── ABA COMPRAS ──────────────────────────────────────────────────── */}
      {activeTab === 'compras' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {fornecedorOptions.map((f, i) => {
              const val = totaisFornecedor[f] || 0;
              const perc = grandTotalC > 0 ? ((val/grandTotalC)*100).toFixed(0) : 0;
              const isActive = filterFornecedor === f;
              return (
                <GradientCard key={f} title={f} value={formatCurrency(val)} sub={`${perc}% do total`} icon={ShoppingCart} gradient={['orange','blue','purple'][i]||'slate'} active={isActive} onClick={() => setFilterFornecedor(isActive?'all':f)} />
              );
            })}
            <GradientCard title="Total Compras" value={formatCurrency(grandTotalC)} sub={`${compras.length} itens`} icon={TrendingDown} gradient="red" />
          </div>
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={searchC} onChange={e => setSearchC(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterFornecedor} onValueChange={setFilterFornecedor}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{fornecedorOptions.map(f=><SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterCategoriaC} onValueChange={setFilterCategoriaC}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem>{categoriaComprasOptions.map(c=><SelectItem key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
                  {[
                    ['data_emissao', 'Data', 'left'],
                    ['descricao_produto', 'Produto', 'left'],
                    ['fornecedor', 'Fornecedor', 'left'],
                    ['categoria_produto', 'Categoria', 'left'],
                    ['quantidade', 'Qtd', 'right'],
                    ['valor_unitario', 'Unit.', 'right'],
                    ['valor_total', 'Total', 'right'],
                  ].map(([field, label, align]) => (
                    <SortableTh key={field} field={field} align={align} className="py-3"
                      sortField={sortC.sortField} sortDir={sortC.sortDir} onSort={sortC.handleSort}>{label}</SortableTh>
                  ))}
                </tr></thead>
                <tbody>
                  {loadingC ? <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                  : filteredC.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Nenhuma compra encontrada</td></tr>
                  : sortC.sorted.map(c => (
                    <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.data_emissao)}</td>
                      <td className="px-4 py-3"><p className="font-medium">{c.descricao_produto}</p>{c.numero_nota && <p className="text-xs text-muted-foreground">NF {c.numero_nota}</p>}</td>
                      <td className="px-4 py-3 text-xs">{c.fornecedor}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoriaComprasColors[c.categoria_produto]||'bg-slate-100 text-slate-700'}`}>{c.categoria_produto}</span></td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.quantidade}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.valor_unitario ? formatCurrency(c.valor_unitario) : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600">{formatCurrency(c.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
                {filteredC.length > 0 && <tfoot><tr className="border-t-2 bg-muted/30">
                  <td colSpan={6} className="px-4 py-3 font-semibold">Total ({filteredC.length} itens)</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(filteredC.reduce((s,c)=>s+(c.valor_total||0),0))}</td>
                </tr></tfoot>}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── ABA DESPESAS ─────────────────────────────────────────────────── */}
      {activeTab === 'despesas' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <GradientCard title="Total do Mês" value={formatCurrency(totalMesD)} sub={`${despesasMes.length} despesas`} icon={TrendingDown} gradient="red" />
            <GradientCard title="Pago" value={formatCurrency(totalPago)} sub={`${despesasMes.filter(d=>d.status==='pago').length} itens`} icon={CheckCircle} gradient="green" />
            <GradientCard title="Pendente / Vencido" value={formatCurrency(totalPendente)} sub={`${despesasMes.filter(d=>d.status!=='pago').length} itens`} icon={AlertTriangle} gradient={totalPendente>0?'orange':'teal'} />
            <div className="bg-white dark:bg-card border rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top Categorias</p>
              <div className="space-y-1">
                {porCategoria.length===0 ? <p className="text-xs text-muted-foreground">—</p> : porCategoria.map(([cat,val]) => (
                  <div key={cat} className="flex justify-between text-xs">
                    <span className={`px-1.5 py-0.5 rounded-full font-semibold ${categoriaDesepColors[cat]||'bg-slate-100 text-slate-600'}`}>{cat}</span>
                    <span className="font-bold text-foreground">{formatCurrency(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar descrição ou fornecedor..." value={searchD} onChange={e => setSearchD(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterCategoriaD} onValueChange={setFilterCategoriaD}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem>{CATEGORIAS_DESP.map(c=><SelectItem key={c} value={c}>{c.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
                  {[
                    ['data', 'Data', 'left', 'py-3'],
                    ['descricao', 'Descrição', 'left', 'py-3'],
                    ['fornecedor', 'Fornecedor', 'left', 'py-3 hidden sm:table-cell'],
                    ['categoria', 'Categoria', 'left', 'py-3'],
                    ['empresa', 'Empresa', 'left', 'py-3 hidden md:table-cell'],
                    ['forma_pagamento', 'Forma Pag.', 'left', 'py-3 hidden lg:table-cell'],
                    ['valor', 'Valor', 'right', 'py-3'],
                    ['status', 'Status', 'left', 'py-3'],
                  ].map(([field, label, align, cls]) => (
                    <SortableTh key={field} field={field} align={align} className={cls}
                      sortField={sortD.sortField} sortDir={sortD.sortDir} onSort={sortD.handleSort}>{label}</SortableTh>
                  ))}
                </tr></thead>
                <tbody>
                  {loadingD ? <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                  : filteredD.length===0 ? <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhuma despesa encontrada</td></tr>
                  : sortD.sorted.map(d => (
                    <tr key={d.id} className={`border-b hover:bg-muted/30 transition-colors ${d.status==='vencido'?'bg-red-50':''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(d.data)}</td>
                      <td className="px-4 py-3"><p className="font-medium">{d.descricao}</p>{d.recorrente&&<p className="text-xs text-muted-foreground">🔄 Recorrente</p>}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{d.fornecedor||'—'}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoriaDesepColors[d.categoria]||'bg-slate-100 text-slate-700'}`}>{(d.categoria||'').replace(/_/g,' ')}</span></td>
                      <td className="px-4 py-3 text-xs hidden md:table-cell">{d.empresa||'—'}</td>
                      <td className="px-4 py-3 text-xs hidden lg:table-cell">{d.forma_pagamento||'—'}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600">{formatCurrency(d.valor)}</td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
                {filteredD.length > 0 && <tfoot><tr className="border-t-2 bg-muted/30">
                  <td colSpan={6} className="px-4 py-3 font-semibold">Total ({filteredD.length} itens)</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(filteredD.reduce((s,d)=>s+(d.valor||0),0))}</td>
                  <td></td>
                </tr></tfoot>}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── ABA DDA × CONTAS A PAGAR (conciliação) ───────────────────────── */}
      {activeTab === 'conciliacao' && (
        <ConciliacaoDDAvsContas selectedMonth={selectedMonth} isAnnual={isAnnual} />
      )}

      {/* ── FORM COMPRAS ─────────────────────────────────────────────────── */}
      <Dialog open={showFormC} onOpenChange={setShowFormC}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Compra</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitC} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <Label>Fornecedor</Label>
                <Input value={fornInput} onChange={e=>{setFornInput(e.target.value);setShowFornSugg(true);}} onFocus={()=>setShowFornSugg(true)} onBlur={()=>setTimeout(()=>setShowFornSugg(false),150)} placeholder="Digite ou selecione..." />
                {showFornSugg && fornSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-popover border rounded-md shadow-md mt-1 max-h-40 overflow-y-auto">
                    {fornSuggestions.map(f=><div key={f} className="px-3 py-2 text-sm cursor-pointer hover:bg-accent" onMouseDown={()=>{setFornInput(f);setShowFornSugg(false);}}>{f}</div>)}
                  </div>
                )}
              </div>
              <div><Label>Data Emissão</Label><Input type="date" value={formC.data_emissao} onChange={e=>setFormC({...formC,data_emissao:e.target.value})} required /></div>
            </div>
            <div><Label>Descrição do Produto</Label><Input value={formC.descricao_produto} onChange={e=>setFormC({...formC,descricao_produto:e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoria</Label>
                <Select value={formC.categoria_produto} onValueChange={v=>setFormC({...formC,categoria_produto:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categoriaComprasOptions.map(c=><SelectItem key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nº Nota</Label><Input value={formC.numero_nota} onChange={e=>setFormC({...formC,numero_nota:e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Quantidade</Label><Input type="number" value={formC.quantidade} onChange={e=>setFormC({...formC,quantidade:e.target.value})} /></div>
              <div><Label>Valor Unit.</Label><Input type="number" step="0.01" value={formC.valor_unitario} onChange={e=>setFormC({...formC,valor_unitario:e.target.value})} /></div>
              <div><Label>Valor Total</Label><Input type="number" step="0.01" value={formC.valor_total} onChange={e=>setFormC({...formC,valor_total:e.target.value})} required /></div>
            </div>
            <Button type="submit" className="w-full">Salvar Compra</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── FORM DESPESAS ────────────────────────────────────────────────── */}
      <Dialog open={showFormD} onOpenChange={setShowFormD}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Despesa Operacional</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitD} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data *</Label><Input type="date" value={formD.data} onChange={e=>setFormD({...formD,data:e.target.value})} required /></div>
              <div><Label>Empresa</Label>
                <Select value={formD.empresa} onValueChange={v=>setFormD({...formD,empresa:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPRESAS.map(e=><SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição *</Label><Input value={formD.descricao} onChange={e=>setFormD({...formD,descricao:e.target.value})} required /></div>
            <div><Label>Fornecedor / Beneficiário</Label><Input value={formD.fornecedor} onChange={e=>setFormD({...formD,fornecedor:e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoria *</Label>
                <Select value={formD.categoria} onValueChange={v=>setFormD({...formD,categoria:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS_DESP.map(c=><SelectItem key={c} value={c}>{c.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Forma de Pagamento</Label>
                <Select value={formD.forma_pagamento} onValueChange={v=>setFormD({...formD,forma_pagamento:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAS_PAG.map(f=><SelectItem key={f} value={f}>{f.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor *</Label><Input type="number" step="0.01" value={formD.valor} onChange={e=>setFormD({...formD,valor:e.target.value})} required /></div>
              <div><Label>Status</Label>
                <Select value={formD.status} onValueChange={v=>setFormD({...formD,status:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Vencimento</Label><Input type="date" value={formD.data_vencimento} onChange={e=>setFormD({...formD,data_vencimento:e.target.value})} /></div>
              <div className="flex items-center gap-2 mt-6">
                <input type="checkbox" id="recorrente" checked={formD.recorrente} onChange={e=>setFormD({...formD,recorrente:e.target.checked})} className="w-4 h-4" />
                <Label htmlFor="recorrente">Recorrente</Label>
              </div>
            </div>
            <Button type="submit" className="w-full">Salvar Despesa</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}