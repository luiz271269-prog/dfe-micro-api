import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { 
  Landmark, FileText, Receipt, ShoppingCart, Hammer, CreditCard, 
  AlertTriangle, TrendingUp, TrendingDown, Bell, Users, BarChart3
} from 'lucide-react';
import { formatCurrency } from '../lib/formatters';

function SectionTitle({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 mt-8 mb-3 first:mt-0">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</h2>
    </div>
  );
}

function DashCard({ title, value, sub, icon: Icon, color, href }) {
  const colors = {
    green: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300',
    red: 'bg-red-50 border-red-100 hover:border-red-300',
    blue: 'bg-blue-50 border-blue-100 hover:border-blue-300',
    yellow: 'bg-amber-50 border-amber-100 hover:border-amber-300',
    purple: 'bg-purple-50 border-purple-100 hover:border-purple-300',
    orange: 'bg-orange-50 border-orange-100 hover:border-orange-300',
    emerald: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300',
    slate: 'bg-slate-50 border-slate-100 hover:border-slate-300',
  };
  const iconColors = {
    green: 'text-emerald-600', red: 'text-red-600', blue: 'text-blue-600',
    yellow: 'text-amber-600', purple: 'text-purple-600', orange: 'text-orange-600',
    emerald: 'text-emerald-600', slate: 'text-slate-600',
  };
  const valColors = {
    green: 'text-emerald-700', red: 'text-red-700', blue: 'text-blue-700',
    yellow: 'text-amber-700', purple: 'text-purple-700', orange: 'text-orange-700',
    emerald: 'text-emerald-700', slate: 'text-slate-700',
  };
  const cls = colors[color] || colors.blue;
  const icCls = iconColors[color] || iconColors.blue;
  const valCls = valColors[color] || valColors.blue;

  const inner = (
    <div className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-md cursor-pointer group ${cls}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        {Icon && <Icon className={`w-4 h-4 ${icCls}`} />}
      </div>
      <p className={`text-xl font-bold tracking-tight ${valCls}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
  if (href) return <Link to={href}>{inner}</Link>;
  return inner;
}

export default function Dashboard() {
  const [data, setData] = useState({
    bankBalance: 54187.06, liesch: 41, fundos: 100000,
    recYTD: 421769, pagYTD: -390000,
    totalFat: 570423, aReceber: 143000, tiago: 235000, thais: 315000,
    emitido: 745734, recebido: 466030, emAberto: 279704,
    totalCompras: 400283, totalObras: 11557,
    totalCartoes: 26553, proxVenc: 672.85,
    totalTrib: 57738, dasMarco: 36377,
    tribVencer: 0, tribVencidos: 0,
    funcAtivos: 0, folhaAtual: 0,
    saldoProjetado: 54187.06,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [lanc, nfs, tit, comp, obras, trib, func, folhas] = await Promise.all([
          base44.entities.LancamentoBancario.list(),
          base44.entities.NotaFiscal.list(),
          base44.entities.TituloCobranca.list(),
          base44.entities.ItemCompra.list(),
          base44.entities.ObraReforma.list(),
          base44.entities.Tributo.list(),
          base44.entities.Funcionario.list(),
          base44.entities.FolhaPagamento.list(),
        ]);
        setData(prev => {
          const d = { ...prev };
          if (lanc.length) {
            d.recYTD = lanc.filter(l => l.categoria === 'recebimento').reduce((s, l) => s + (l.valor || 0), 0) || prev.recYTD;
            d.pagYTD = lanc.filter(l => l.categoria !== 'recebimento').reduce((s, l) => s + Math.abs(l.valor || 0), 0) || prev.pagYTD;
          }
          if (nfs.length) {
            d.totalFat = nfs.reduce((s, n) => s + (n.valor_total || 0), 0);
            d.aReceber = nfs.reduce((s, n) => s + (n.valor_aberto || 0), 0);
            d.tiago = nfs.filter(n => n.vendedor === 'Tiago').reduce((s, n) => s + (n.valor_total || 0), 0) || prev.tiago;
            d.thais = nfs.filter(n => n.vendedor === 'Thais').reduce((s, n) => s + (n.valor_total || 0), 0) || prev.thais;
          }
          if (tit.length) {
            d.emitido = tit.reduce((s, t) => s + (t.valor_titulo || 0), 0);
            d.recebido = tit.filter(t => t.status === 'pago').reduce((s, t) => s + (t.valor_pago || 0), 0);
            d.emAberto = tit.filter(t => t.status !== 'pago').reduce((s, t) => s + (t.valor_titulo || 0), 0);
          }
          if (comp.length) d.totalCompras = comp.reduce((s, c) => s + (c.valor_total || 0), 0);
          if (obras.length) d.totalObras = obras.reduce((s, o) => s + (o.valor || 0), 0);
          if (trib.length) {
            d.totalTrib = trib.reduce((s, t) => s + (t.valor_original || 0), 0);
            d.tribVencer = trib.filter(t => t.status === 'a_vencer').length;
            d.tribVencidos = trib.filter(t => t.status === 'vencido').length;
            const dasMarco = trib.find(t => t.tipo === 'DAS' && t.competencia === '2026-03');
            if (dasMarco) d.dasMarco = dasMarco.valor_original;
          }
          if (func.length) d.funcAtivos = func.filter(f => f.status === 'ativo').length;
          if (folhas.length) {
            const currentMes = new Date().toISOString().slice(0, 7);
            d.folhaAtual = folhas.filter(f => f.competencia === currentMes && f.status === 'pago')
              .reduce((s, f) => s + (f.salario_liquido || 0), 0);
          }
          return d;
        });
      } catch (_) {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const percCob = data.emitido > 0 ? ((data.recebido / data.emitido) * 100).toFixed(1) : '62.6';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-0.5">NeuralTec Distribuição e Tecnologia Ltda · Março 2026</p>
      </div>

      {/* Alert card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Bell className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Itens que precisam de atenção</p>
          <div className="mt-1 flex flex-wrap gap-3">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">📤 DDA semana 30/03—01/04: NeuralTec R$ 925,15 · Liesch R$ 606,29 · KLI R$ 1.143,31 — Total R$ 2.674,75</span>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">⚠ DAS Mar/2026: R$ 36.377 — verificar</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">✅ Sicredi NeuralTec mar/2026 pago em 25/03</span>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">💰 A receber: {formatCurrency(data.aReceber)}</span>
          </div>
        </div>
      </div>

      {/* Banco */}
      <SectionTitle icon={Landmark} label="Banco" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DashCard title="Saldo NeuralTec" value={formatCurrency(data.bankBalance)} sub="Conta 36092-2" icon={Landmark} color="blue" href="/extrato" />
        <DashCard title="Liesch + Fundos" value={formatCurrency(data.liesch + data.fundos)} sub="R$41 + R$100k fundos" icon={Landmark} color="slate" href="/extrato" />
        <DashCard title="Recebimentos YTD" value={formatCurrency(data.recYTD)} icon={TrendingUp} color="green" href="/extrato" />
        <DashCard title="Pagamentos YTD" value={formatCurrency(-data.pagYTD)} icon={TrendingDown} color="red" href="/extrato" />
      </div>

      {/* Faturamento */}
      <SectionTitle icon={FileText} label="Faturamento" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DashCard title="Total Faturado" value={formatCurrency(data.totalFat)} icon={FileText} color="green" href="/faturamento" />
        <DashCard title="A Receber" value={formatCurrency(data.aReceber)} icon={FileText} color="orange" href="/faturamento" />
        <DashCard title="Tiago (V-01)" value={formatCurrency(data.tiago)} icon={FileText} color="blue" href="/faturamento" />
        <DashCard title="Thais (V-05)" value={formatCurrency(data.thais)} icon={FileText} color="purple" href="/faturamento" />
      </div>

      {/* Cobranças */}
      <SectionTitle icon={Receipt} label="Cobranças Sicredi" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DashCard title="Total Emitido" value={formatCurrency(data.emitido)} icon={Receipt} color="blue" href="/cobrancas" />
        <DashCard title="Recebido" value={formatCurrency(data.recebido)} sub={`${percCob}% do emitido`} icon={Receipt} color="green" href="/cobrancas" />
        <DashCard title="Em Aberto" value={formatCurrency(data.emAberto)} icon={Receipt} color="orange" href="/cobrancas" />
      </div>

      {/* Compras + Obras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionTitle icon={ShoppingCart} label="Compras" />
          <div className="grid grid-cols-1 gap-3">
            <DashCard title="Total Compras YTD" value={formatCurrency(-data.totalCompras)} sub="À Vista 65% · ML 27% · Pauta 8%" icon={ShoppingCart} color="red" href="/compras" />
          </div>
        </div>
        <div>
          <SectionTitle icon={Hammer} label="Obras e Reformas" />
          <div className="grid grid-cols-1 gap-3">
            <DashCard title="Total Obras YTD" value={formatCurrency(-data.totalObras)} sub="Mão de obra R$9.500 · Mat. R$2.057" icon={Hammer} color="emerald" href="/obras" />
          </div>
        </div>
      </div>

      {/* Cartões + Tributos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionTitle icon={CreditCard} label="Cartões de Crédito" />
          <div className="grid grid-cols-2 gap-3">
            <DashCard title="Pago no Banco" value={formatCurrency(-data.totalCartoes)} sub="7 cartões" icon={CreditCard} color="purple" href="/cartoes" />
            <DashCard title="Próx. Vencimento" value={formatCurrency(data.proxVenc)} sub="25/03 Sicredi NT" icon={CreditCard} color="yellow" href="/cartoes" />
          </div>
        </div>
        <div>
          <SectionTitle icon={AlertTriangle} label="Tributos" />
          <div className="grid grid-cols-2 gap-3">
            <DashCard title="Total a Pagar" value={formatCurrency(data.totalTrib)} sub={`${data.tribVencer} a vencer`} icon={AlertTriangle} color="blue" href="/tributos" />
            <DashCard title="Vencidos" value={data.tribVencidos} sub="⚠ Ação imediata" icon={AlertTriangle} color={data.tribVencidos > 0 ? 'red' : 'green'} href="/tributos" />
          </div>
        </div>
      </div>

      {/* Pessoal + Fluxo de Caixa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionTitle icon={Users} label="Gestão de Pessoal" />
          <div className="grid grid-cols-2 gap-3">
            <DashCard title="Funcionários Ativos" value={data.funcAtivos} sub="colaboradores" icon={Users} color="blue" href="/funcionarios" />
            <DashCard title="Folha do Mês" value={formatCurrency(data.folhaAtual)} sub="mês atual" icon={Users} color="purple" href="/funcionarios" />
          </div>
        </div>
        <div>
          <SectionTitle icon={BarChart3} label="Fluxo de Caixa" />
          <div className="grid grid-cols-2 gap-3">
            <DashCard title="Saldo Projetado" value={formatCurrency(data.saldoProjetado)} sub="próx. 30 dias" icon={BarChart3} color={data.saldoProjetado < 0 ? 'red' : 'green'} href="/fluxocaixa" />
            <DashCard title="Status Caixa" value={data.saldoProjetado < 0 ? '⚠ Crítico' : '✓ OK'} sub="monitorar fluxo" icon={BarChart3} color={data.saldoProjetado < 0 ? 'red' : 'green'} href="/fluxocaixa" />
          </div>
        </div>
      </div>
    </div>
  );
}