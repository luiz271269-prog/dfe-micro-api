import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  Landmark, FileText, Receipt, ShoppingCart, Hammer, CreditCard,
  AlertTriangle, TrendingUp, TrendingDown, Bell, Users, BarChart3,
  ChevronLeft, ChevronRight, Building2, Wallet, PiggyBank, DollarSign } from
'lucide-react';
import { formatCurrency } from '../lib/formatters';
import DASAlertBadge from '../components/dashboard/DASAlertBadge';
import { getCurrentMonth } from '../lib/currentMonth';
import DedupButton from '../components/shared/DedupButton';
import SyncCalendarButton from '../components/shared/SyncCalendarButton';

const ALL_MONTHS = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

function fmtMes(m) {
  const [y, mo] = m.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(mo) - 1]}/${y.slice(2)}`;
}

function fmtMesLong(m) {
  const [y, mo] = m.split('-');
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${nomes[parseInt(mo) - 1]} ${y}`;
}

function asArray(r) {return Array.isArray(r) ? r : [];}

// Metric card with gradient accent
function MetricCard({ title, value, sub, icon: Icon, gradient, href, accent }) {
  const gradients = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-teal-600',
    red: 'from-rose-500 to-red-600',
    purple: 'from-purple-500 to-violet-600',
    orange: 'from-orange-500 to-amber-600',
    teal: 'from-teal-500 to-cyan-600',
    indigo: 'from-indigo-500 to-blue-700',
    slate: 'from-slate-500 to-slate-700',
    amber: 'from-amber-500 to-yellow-600',
    pink: 'from-pink-500 to-rose-600',
    lime: 'from-lime-500 to-green-600',
    sky: 'from-sky-500 to-blue-500'
  };
  const grad = gradients[gradient || 'blue'];

  const inner =
  <div className="group relative bg-white dark:bg-card rounded-2xl border border-border/60 overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
      {/* Gradient top bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${grad}`} />
      <div className="px-4">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{title}</p>
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm shrink-0`}>
            {Icon && <Icon className="w-4 h-4 text-white" />}
          </div>
        </div>
        <p className="text-xl font-bold text-foreground tracking-tight leading-none mb-1.5">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>;

  if (href) return <Link to={href}>{inner}</Link>;
  return inner;
}

// Section block — colored header strip
function Section({ icon: Icon, label, gradient, children, cols = 4 }) {
  const gradients = {
    blue: 'from-blue-600 to-blue-700',
    green: 'from-emerald-600 to-teal-700',
    orange: 'from-orange-500 to-amber-600',
    purple: 'from-purple-600 to-violet-700',
    teal: 'from-teal-600 to-cyan-700',
    red: 'from-rose-600 to-red-700',
    indigo: 'from-indigo-600 to-blue-800',
    slate: 'from-slate-600 to-slate-800',
    amber: 'from-amber-600 to-yellow-700',
    lime: 'from-lime-600 to-green-700',
    sky: 'from-sky-600 to-blue-600'
  };
  const grad = gradients[gradient] || gradients.blue;
  const colsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4'
  }[cols] || 'grid-cols-2 lg:grid-cols-4';

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-border/60 overflow-hidden shadow-sm">
      {/* Section header */}
      <div className={`bg-gradient-to-r px-2 ${grad} flex items-center gap-2.5`}>
        {Icon && <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center"><Icon className="w-4 h-4 text-white" /></div>}
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">{label}</h2>
      </div>
      <div className={`grid ${colsClass} gap-0 divide-x divide-y divide-border/40`}>
        {children}
      </div>
    </div>);

}

// Inner metric for section (no card, uses section's bg)
function SectionMetric({ title, value, sub, icon: Icon, valueColor, href }) {
  const valCls = {
    green: 'text-emerald-600',
    red: 'text-rose-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600',
    default: 'text-foreground'
  }[valueColor || 'default'];

  const inner =
  <div className="group hover:bg-muted/30 transition-colors cursor-pointer px-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
        {Icon && <Icon className={`w-4 h-4 opacity-50 ${valCls}`} />}
      </div>
      <p className={`text-lg font-bold tracking-tight ${valCls}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>;

  if (href) return <Link to={href}>{inner}</Link>;
  return inner;
}

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isAnnual, setIsAnnual] = useState(false);
  const [rawData, setRawData] = useState({ lanc: [], nfs: [], tit: [], comp: [], obras: [], trib: [], func: [], folhas: [], faturas: [] });
  const [data, setData] = useState({
    bankBalance: 0, liesch: 41, fundos: 100000,
    recYTD: 0, pagYTD: 0,
    totalFat: 0, aReceber: 0, tiago: 0, thais: 0,
    emitido: 0, recebido: 0, emAberto: 0,
    totalCompras: 0, totalObras: 0,
    totalCartoes: 0, proxVenc: 0, nCartoes: 0,
    totalTrib: 0, tribVencer: 0, tribVencidos: 0,
    funcAtivos: 0, folhaAtual: 0,
    saldoProjetado: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Verificar refresh pendente ao montar (vindo de outra página após importação)
    const pending = localStorage.getItem('neuralfinPendingRefresh');
    if (pending) {
      localStorage.removeItem('neuralfinPendingRefresh');
      setRefreshKey((k) => k + 1);
    }
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener('neuralfinRefresh', handler);
    // Reload when user returns to this tab/page
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const p = localStorage.getItem('neuralfinPendingRefresh');
        if (p) {
          localStorage.removeItem('neuralfinPendingRefresh');
          setRefreshKey((k) => k + 1);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('neuralfinRefresh', handler);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Correção 4: corrigir mes_referencia nulos uma única vez
  useEffect(() => {
    if (!localStorage.getItem('mesRef_corrigido_v1')) {
      base44.entities.LancamentoBancario.filter({ mes_referencia: null }).then((semMes) => {
        if (!semMes?.length) return;
        Promise.all(semMes.filter((r) => r.data).map((r) =>
        base44.entities.LancamentoBancario.update(r.id, { mes_referencia: r.data.substring(0, 7) })
        )).then(() => localStorage.setItem('mesRef_corrigido_v1', '1'));
      });
    }
  }, []);

  useEffect(() => {
    async function load() {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      // Carrega uma entidade com retry/backoff em caso de rate limit (429).
      // Nunca lança: se falhar após as tentativas, devolve [] para não derrubar o painel.
      const listSafe = async (entity, tentativas = 4) => {
        for (let i = 0; i < tentativas; i++) {
          try {
            return await base44.entities[entity].list();
          } catch (e) {
            const isRateLimit = e?.status === 429 || (e?.message || '').toLowerCase().includes('rate limit');
            if (isRateLimit && i < tentativas - 1) {
              await sleep(1200 * (i + 1));
              continue;
            }
            return [];
          }
        }
        return [];
      };

      // Carregar em lotes para não exceder rate limit
      const [lancRaw, nfsRaw, titRaw] = await Promise.all([
      listSafe('LancamentoBancario'),
      listSafe('NotaFiscal'),
      listSafe('TituloCobranca')]
      );
      await sleep(400);
      const [compRaw, obrasRaw, tribRaw] = await Promise.all([
      listSafe('ItemCompra'),
      listSafe('ObraReforma'),
      listSafe('Tributo')]
      );
      await sleep(400);
      const [funcRaw, folhasRaw, faturasRaw] = await Promise.all([
      listSafe('Funcionario'),
      listSafe('FolhaPagamento'),
      listSafe('FaturaCartao')]
      );
      const lancArr = Array.isArray(lancRaw) ? lancRaw : [];
      // Calcular saldo real: último lançamento NeuralTec com saldo_apos
      const neuralLanc = lancArr.
      filter((l) => l.conta_bancaria === 'NeuralTec 36092-2' && l.saldo_apos != null).
      sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      const saldoReal = neuralLanc.length > 0 ? neuralLanc[0].saldo_apos : 0;
      const faturasArr = Array.isArray(faturasRaw) ? faturasRaw : [];
      setRawData({
        lanc: lancArr,
        nfs: Array.isArray(nfsRaw) ? nfsRaw : [],
        tit: Array.isArray(titRaw) ? titRaw : [],
        comp: Array.isArray(compRaw) ? compRaw : [],
        obras: Array.isArray(obrasRaw) ? obrasRaw : [],
        trib: Array.isArray(tribRaw) ? tribRaw : [],
        func: Array.isArray(funcRaw) ? funcRaw : [],
        folhas: Array.isArray(folhasRaw) ? folhasRaw : [],
        faturas: faturasArr
      });
      if (saldoReal > 0) {
        setData((prev) => ({ ...prev, bankBalance: saldoReal, saldoProjetado: saldoReal }));
      }
      setLoading(false);
    }
    load();
  }, [refreshKey]); // eslint-disable-line

  useEffect(() => {
    const { lanc, nfs, tit, comp, obras, trib, func, folhas, faturas } = rawData;
    // Correção 2: filtrar lançamentos por data para pegar registros com mes_referencia null
    const inicio = selectedMonth + '-01';
    const fim = selectedMonth + '-31';
    const lancF = isAnnual ? lanc : lanc.filter((r) => {
      if (!r.data) return false;
      return r.data >= inicio && r.data <= fim;
    });
    const f = (arr, field) => isAnnual ? arr : arr.filter((r) => (r[field] || '').startsWith(selectedMonth));
    const nfsF = f(nfs, 'data_emissao'),titF = f(tit, 'data_vencimento');
    const compF = f(comp, 'data_emissao'),obrasF = f(obras, 'data');
    setData((prev) => {
      const d = { ...prev };
      if (lanc.length) {
        d.recYTD = lancF.filter((l) => l.categoria === 'recebimento').reduce((s, l) => s + (l.valor || 0), 0);
        d.pagYTD = lancF.filter((l) => l.categoria !== 'recebimento').reduce((s, l) => s + Math.abs(l.valor || 0), 0);
      }
      if (nfs.length) {
        // Exclui NFs-espelho de CI (já contabilizadas no CI — evita dupla contagem)
        const nfsValidas = nfsF.filter((n) => !n.is_espelho_ci);
        d.totalFat = nfsValidas.reduce((s, n) => s + (n.valor_total || 0), 0);
        d.aReceber = nfsValidas.reduce((s, n) => s + (n.valor_aberto || 0), 0);
        d.tiago = nfsValidas.filter((n) => n.vendedor === 'Tiago').reduce((s, n) => s + (n.valor_total || 0), 0);
        d.thais = nfsValidas.filter((n) => n.vendedor === 'Thais').reduce((s, n) => s + (n.valor_total || 0), 0);
      }
      if (tit.length) {
        // Emitido: títulos com vencimento no mês selecionado
        d.emitido = titF.reduce((s, t) => s + (t.valor_titulo || 0), 0);
        // Recebido: títulos pagos no mês selecionado (filtra por data_pagamento, não por vencimento)
        const recebidosNoMes = isAnnual ?
        tit.filter((t) => t.status === 'pago') :
        tit.filter((t) => t.status === 'pago' && (t.data_pagamento || '').startsWith(selectedMonth));
        d.recebido = recebidosNoMes.reduce((s, t) => s + (t.valor_pago || 0), 0);
        // Em Aberto: TOTAL GERAL de títulos em aberto (independente do mês — controle por dia do vencimento)
        d.emAberto = tit.filter((t) => t.status !== 'pago').reduce((s, t) => s + (t.valor_titulo || 0), 0);
      }
      if (comp.length) d.totalCompras = compF.reduce((s, c) => s + (c.valor_total || 0), 0);
      if (obras.length) d.totalObras = obrasF.reduce((s, o) => s + (o.valor || 0), 0);
      if (trib.length) {
        const tribPendentes = trib.filter((t) => t.status === 'a_vencer' || t.status === 'vencido');
        d.totalTrib = tribPendentes.reduce((s, t) => s + (t.valor_original || 0), 0);
        d.tribVencer = trib.filter((t) => t.status === 'a_vencer').length;
        d.tribVencidos = trib.filter((t) => t.status === 'vencido').length;
      }
      if (func.length) d.funcAtivos = func.filter((f) => f.status === 'ativo').length;
      if (folhas.length) d.folhaAtual = folhas.filter((f) => f.competencia === selectedMonth && f.status === 'pago').reduce((s, f) => s + (f.salario_liquido || 0), 0);
      if (faturas.length) {
        const faturasF = isAnnual ? faturas : faturas.filter((f) => (f.mes_referencia || '').startsWith(selectedMonth));
        d.totalCartoes = faturasF.reduce((s, f) => s + (f.valor_total || 0), 0);
        d.nCartoes = new Set(faturasF.map((f) => f.conta_cartao_id).filter(Boolean)).size;
        // Próx vencimento: menor data_vencimento entre faturas não pagas
        const abertas = faturas.filter((f) => f.status !== 'paga_total').sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''));
        d.proxVenc = abertas.length > 0 ? abertas[0].valor_total : 0;
      }
      return d;
    });
  }, [rawData, selectedMonth, isAnnual]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>);


  const percCob = data.emitido > 0 ? (data.recebido / data.emitido * 100).toFixed(1) : '—';
  const monthIdx = ALL_MONTHS.indexOf(selectedMonth);

  return (
    <div className="lg:px-6 lg:py-6 max-w-[1600px] mx-auto space-y-5">

      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Painel Financeiro</h1>
          <p className="text-sm text-muted-foreground">NeuralTec Distribuição e Tecnologia Ltda</p>
        </div>
        {/* Month picker */}
        <div className="flex items-center gap-1.5 flex-wrap px-48">
          <button onClick={() => {setIsAnnual(false);if (monthIdx > 0) setSelectedMonth(ALL_MONTHS[monthIdx - 1]);}}
          disabled={monthIdx === 0 || isAnnual}
          className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {ALL_MONTHS.slice(-5).map((m) =>
          <button key={m} onClick={() => {setSelectedMonth(m);setIsAnnual(false);}}
          className={`rounded-lg font-bold transition-all text-sm px-4 ${!isAnnual && selectedMonth === m ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'border hover:bg-muted text-muted-foreground'}`}>
              {fmtMes(m)}
            </button>
          )}
          <button onClick={() => {setIsAnnual(false);if (monthIdx < ALL_MONTHS.length - 1) setSelectedMonth(ALL_MONTHS[monthIdx + 1]);}}
          disabled={monthIdx === ALL_MONTHS.length - 1 || isAnnual}
          className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setIsAnnual(!isAnnual)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ml-1 ${isAnnual ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'border hover:bg-muted text-muted-foreground'}`}>
            Anual
          </button>
          <DedupButton autoOncePerDay />
          <SyncCalendarButton />
        </div>
      </div>

      {/* ─── KPI HERO ROW ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Saldo NeuralTec" value={formatCurrency(data.bankBalance)} sub="Conta Sicredi 36092-2" icon={Landmark} gradient="sky" href="/extrato" />
        <MetricCard title="Total Faturado" value={formatCurrency(data.totalFat)} sub={isAnnual ? 'Acumulado anual' : fmtMesLong(selectedMonth)} icon={TrendingUp} gradient="green" href="/faturamento" />
        <MetricCard title="A Receber" value={formatCurrency(data.aReceber)} sub="Em aberto NFs" icon={Wallet} gradient="orange" href="/faturamento" />
        <MetricCard title="Cobranças Recebidas" value={`${percCob}%`} sub={`${formatCurrency(data.recebido)} de ${formatCurrency(data.emitido)}`} icon={PiggyBank} gradient="teal" href="/cobrancas" />
      </div>

      {/* ─── CTA CONTAS A PAGAR ─── */}
      <Link to="/contas-a-pagar" className="block">
        <div className="bg-gradient-to-r from-rose-600 to-red-700 rounded-2xl flex items-center justify-between gap-4 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Contas a Pagar — Agenda Consolidada</p>
              <p className="text-[11px] opacity-90">Despesas + Tributos + Folha + Faturas de cartão com aging e baixa automática pelo extrato</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5" />
        </div>
      </Link>

      {/* ─── CTA CONTROLE DE PRODUTOS (IA) ─── */}
      <Link to="/controle-produtos" className="block">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-between gap-4 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all px-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Controle de Produtos — 3-Way Matching com Agente IA</p>
              <p className="text-[11px] opacity-90">SKU virtual · custo médio ponderado · anti-dupla-contagem · Financial Controller</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5" />
        </div>
      </Link>

      {/* ─── ALERT BANNER ─── */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-900">Itens que precisam de atenção — {isAnnual ? '2026 (Anual)' : fmtMesLong(selectedMonth)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <DASAlertBadge selectedMonth={selectedMonth} />
            {data.tribVencidos > 0 && <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-medium">⚠ {data.tribVencidos} tributo(s) vencido(s) — ação imediata</span>}
            {data.aReceber > 0 && <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">💰 A receber: {formatCurrency(data.aReceber)}</span>}
            {data.emAberto > 0 && <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">📋 Cobranças em aberto: {formatCurrency(data.emAberto)}</span>}
          </div>
        </div>
      </div>

      {/* ─── GRUPO 1: POSIÇÃO BANCÁRIA ─── */}
      <Section icon={Landmark} label="Posição Bancária" gradient="blue" cols={4}>
        <SectionMetric title="Saldo NeuralTec" value={formatCurrency(data.bankBalance)} sub="Sicredi 36092-2" icon={Landmark} valueColor="blue" href="/extrato" />
        <SectionMetric title="Liesch + Fundos" value={formatCurrency(data.liesch + data.fundos)} sub="R$41 + R$100k em fundos" icon={Building2} valueColor="default" href="/extrato" />
        <SectionMetric title="Entradas" value={formatCurrency(data.recYTD)} sub="Recebimentos" icon={TrendingUp} valueColor="green" href="/extrato" />
        <SectionMetric title="Saídas" value={formatCurrency(-data.pagYTD)} sub="Pagamentos" icon={TrendingDown} valueColor="red" href="/extrato" />
      </Section>

      {/* ─── GRUPO 2: FATURAMENTO ─── */}
      <Section icon={FileText} label="Faturamento" gradient="green" cols={4}>
        <SectionMetric title="Total Faturado" value={formatCurrency(data.totalFat)} sub="NFs + CIs emitidas" icon={FileText} valueColor="green" href="/faturamento" />
        <SectionMetric title="A Receber" value={formatCurrency(data.aReceber)} sub="Saldo em aberto" icon={TrendingUp} valueColor="orange" href="/faturamento" />
        <SectionMetric title="Tiago (V-01)" value={formatCurrency(data.tiago)} sub="Vendas diretas" icon={FileText} valueColor="blue" href="/faturamento" />
        <SectionMetric title="Thais (V-05)" value={formatCurrency(data.thais)} sub="Televendas" icon={FileText} valueColor="purple" href="/faturamento" />
      </Section>

      {/* ─── GRUPO 3: COBRANÇAS ─── */}
      <Section icon={Receipt} label="Cobranças Sicredi" gradient="teal" cols={3}>
        <SectionMetric title="Total Emitido" value={formatCurrency(data.emitido)} sub="Boletos gerados" icon={Receipt} valueColor="blue" href="/cobrancas" />
        <SectionMetric title="Recebido" value={formatCurrency(data.recebido)} sub={`${percCob}% de taxa de recebimento`} icon={TrendingUp} valueColor="green" href="/cobrancas" />
        <SectionMetric title="Em Aberto" value={formatCurrency(data.emAberto)} sub="Total geral — todos os vencimentos" icon={AlertTriangle} valueColor="orange" href="/cobrancas" />
      </Section>

      {/* ─── GRUPO 4: OPERACIONAL (Compras + Obras) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section icon={ShoppingCart} label="Compras" gradient="orange" cols={1}>
          <SectionMetric title="Total de Compras" value={formatCurrency(-data.totalCompras)} sub={isAnnual ? 'Acumulado anual' : fmtMesLong(selectedMonth)} icon={ShoppingCart} valueColor="red" href="/compras" />
        </Section>
        <Section icon={Hammer} label="Obras e Reformas" gradient="lime" cols={1}>
          <SectionMetric title="Total de Obras" value={formatCurrency(-data.totalObras)} sub="Mão de obra + Material" icon={Hammer} valueColor="green" href="/obras" />
        </Section>
      </div>

      {/* ─── GRUPO 5: CARTÕES + TRIBUTOS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section icon={CreditCard} label="Cartões de Crédito" gradient="purple" cols={2}>
          <SectionMetric title="Pago no Banco" value={formatCurrency(-data.totalCartoes)} sub={`${data.nCartoes || '—'} cartões no período`} icon={CreditCard} valueColor="purple" href="/cartoes" />
          <SectionMetric title="Próx. Vencimento" value={formatCurrency(data.proxVenc)} sub="Próxima fatura em aberto" icon={DollarSign} valueColor="amber" href="/cartoes" />
        </Section>
        <Section icon={AlertTriangle} label="Tributos" gradient="red" cols={2}>
          <SectionMetric title="Total a Pagar" value={formatCurrency(data.totalTrib)} sub={`${data.tribVencer} a vencer`} icon={AlertTriangle} valueColor="blue" href="/tributos" />
          <SectionMetric title="Vencidos" value={data.tribVencidos} sub={data.tribVencidos > 0 ? '⚠ Ação imediata' : 'Em dia'} icon={AlertTriangle} valueColor={data.tribVencidos > 0 ? 'red' : 'green'} href="/tributos" />
        </Section>
      </div>

      {/* ─── GRUPO 6: PESSOAS + FLUXO ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section icon={Users} label="Gestão de Pessoas" gradient="indigo" cols={2}>
          <SectionMetric title="Colaboradores Ativos" value={data.funcAtivos} sub="funcionários" icon={Users} valueColor="blue" href="/funcionarios" />
          <SectionMetric title="Folha do Mês" value={formatCurrency(data.folhaAtual)} sub="Total líquido pago" icon={DollarSign} valueColor="purple" href="/funcionarios" />
        </Section>
        <Section icon={BarChart3} label="Fluxo de Caixa" gradient="sky" cols={2}>
          <SectionMetric title="Saldo Projetado" value={formatCurrency(data.saldoProjetado)} sub="próximos 30 dias" icon={BarChart3} valueColor={data.saldoProjetado < 0 ? 'red' : 'green'} href="/fluxocaixa" />
          <SectionMetric title="Status do Caixa" value={data.saldoProjetado < 0 ? '⚠ Crítico' : '✓ OK'} sub="monitorar fluxo" icon={TrendingUp} valueColor={data.saldoProjetado < 0 ? 'red' : 'green'} href="/fluxocaixa" />
        </Section>
      </div>

    </div>);

}