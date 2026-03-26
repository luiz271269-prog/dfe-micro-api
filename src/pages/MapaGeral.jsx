import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Landmark, FileText, Receipt, ShoppingCart, Hammer, CreditCard, 
  CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  DollarSign, Users, BarChart3
} from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency } from '../lib/formatters';

function StatusIndicator({ status }) {
  if (status === 'green') return <CheckCircle className="w-5 h-5 text-green-500" />;
  if (status === 'yellow') return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  return <XCircle className="w-5 h-5 text-red-500" />;
}

function ModuleCard({ icon: Icon, title, status, summary, details, pendencias }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card rounded-xl border overflow-hidden hover:shadow-md transition-shadow">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <StatusIndicator status={status} />
          </div>
          <p className="text-sm text-muted-foreground truncate">{summary}</p>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 border-t pt-4 space-y-3">
          {details && details.map((d, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-medium">{d.value}</span>
            </div>
          ))}
          {pendencias && pendencias.length > 0 && (
            <div className="mt-3 p-3 bg-yellow-500/5 rounded-lg border border-yellow-200">
              <p className="text-xs font-semibold text-yellow-700 mb-1">Pendências:</p>
              {pendencias.map((p, i) => (
                <p key={i} className="text-xs text-yellow-600">• {p}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MapaGeral() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [lanc, nfs, tit, comp, obras, cartoes, faturas, trib, func, folhas, fluxo] = await Promise.all([
        base44.entities.LancamentoBancario.list(),
        base44.entities.NotaFiscal.list(),
        base44.entities.TituloCobranca.list(),
        base44.entities.ItemCompra.list(),
        base44.entities.ObraReforma.list(),
        base44.entities.ContaCartao.list(),
        base44.entities.FaturaCartao.list(),
        base44.entities.Tributo.list(),
        base44.entities.Funcionario.list(),
        base44.entities.FolhaPagamento.list(),
        base44.entities.FluxoCaixa.list(),
      ]);
      const today = new Date();
      const next30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const fluxoProx = fluxo.filter(f => {
        const d = new Date(f.data_prevista);
        return d >= today && d <= next30 && f.status !== 'cancelado';
      });
      const entradasProx = fluxoProx.filter(f => f.tipo === 'entrada').reduce((s, f) => s + f.valor_previsto, 0);
      const saidasProx = fluxoProx.filter(f => f.tipo === 'saida').reduce((s, f) => s + f.valor_previsto, 0);
      const saldoProj = 54187.06 + entradasProx - saidasProx;

      setCounts({
        lancamentos: lanc.length,
        lancTotal: lanc.reduce((s, l) => s + (l.valor || 0), 0),
        nfs: nfs.length,
        nfsTotal: nfs.reduce((s, n) => s + (n.valor_total || 0), 0),
        nfsAberto: nfs.filter(n => n.status !== 'pago').length,
        titulos: tit.length,
        titAberto: tit.filter(t => t.status !== 'pago').length,
        titTotal: tit.reduce((s, t) => s + (t.valor_titulo || 0), 0),
        compras: comp.length,
        compTotal: comp.reduce((s, c) => s + (c.valor_total || 0), 0),
        obras: obras.length,
        obrasTotal: obras.reduce((s, o) => s + (o.valor || 0), 0),
        cartoes: cartoes.length,
        faturas: faturas.length,
        fatAberta: faturas.filter(f => f.status === 'aberta').length,
        tributos: trib.length,
        tribVencer: trib.filter(t => t.status === 'a_vencer').length,
        tribVencidos: trib.filter(t => t.status === 'vencido').length,
        funcAtivos: func.filter(f => f.status === 'ativo').length,
        folhaAtual: folhas.filter(f => f.competencia === today.toISOString().slice(0, 7) && f.status === 'pago').reduce((s, f) => s + (f.salario_liquido || 0), 0),
        fluxoTotal: fluxo.length,
        saldoProjetado: saldoProj,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  const modules = [
    {
      icon: Landmark, title: 'Extrato Bancário',
      status: counts.lancamentos > 0 ? 'green' : 'yellow',
      summary: `${counts.lancamentos} lançamentos registrados`,
      details: [
        { label: 'Total de lançamentos', value: counts.lancamentos },
        { label: 'Movimentação total', value: formatCurrency(counts.lancTotal) },
      ],
      pendencias: counts.lancamentos === 0 ? ['Importar extrato bancário'] : [],
    },
    {
      icon: FileText, title: 'Faturamento',
      status: counts.nfsAberto > 5 ? 'yellow' : counts.nfs > 0 ? 'green' : 'red',
      summary: `${counts.nfs} notas · ${counts.nfsAberto} em aberto`,
      details: [
        { label: 'Total NFs', value: counts.nfs },
        { label: 'Faturamento total', value: formatCurrency(counts.nfsTotal) },
        { label: 'NFs em aberto', value: counts.nfsAberto },
      ],
      pendencias: counts.nfsAberto > 0 ? [`${counts.nfsAberto} NF(s) com recebimento pendente`] : [],
    },
    {
      icon: Receipt, title: 'Cobranças Sicredi',
      status: counts.titAberto > 10 ? 'yellow' : counts.titulos > 0 ? 'green' : 'red',
      summary: `${counts.titulos} títulos · ${counts.titAberto} em aberto`,
      details: [
        { label: 'Total títulos', value: counts.titulos },
        { label: 'Valor total emitido', value: formatCurrency(counts.titTotal) },
        { label: 'Títulos em aberto', value: counts.titAberto },
      ],
      pendencias: counts.titAberto > 0 ? [`${counts.titAberto} título(s) aguardando pagamento`] : [],
    },
    {
      icon: ShoppingCart, title: 'Compras',
      status: counts.compras > 0 ? 'green' : 'yellow',
      summary: `${counts.compras} itens · ${formatCurrency(counts.compTotal)}`,
      details: [
        { label: 'Total de itens', value: counts.compras },
        { label: 'Valor total', value: formatCurrency(counts.compTotal) },
      ],
      pendencias: counts.compras === 0 ? ['Registrar compras realizadas'] : [],
    },
    {
      icon: Hammer, title: 'Obras e Reformas',
      status: counts.obras > 0 ? 'green' : 'yellow',
      summary: `${counts.obras} registros · ${formatCurrency(counts.obrasTotal)}`,
      details: [
        { label: 'Total registros', value: counts.obras },
        { label: 'Investimento total', value: formatCurrency(counts.obrasTotal) },
      ],
      pendencias: [],
    },
    {
      icon: CreditCard, title: 'Cartões de Crédito',
      status: counts.fatAberta > 0 ? 'yellow' : 'green',
      summary: `${counts.cartoes} cartões · ${counts.faturas} faturas · ${counts.fatAberta} abertas`,
      details: [
        { label: 'Cartões cadastrados', value: counts.cartoes },
        { label: 'Faturas registradas', value: counts.faturas },
        { label: 'Faturas abertas', value: counts.fatAberta },
      ],
      pendencias: counts.fatAberta > 0 ? [`${counts.fatAberta} fatura(s) em aberto`] : [],
    },
    {
      icon: DollarSign, title: 'Tributos',
      status: counts.tribVencidos > 0 ? 'red' : counts.tribVencer > 0 ? 'yellow' : 'green',
      summary: `${counts.tributos} tributos · ${counts.tribVencidos} vencidos`,
      details: [
        { label: 'Total tributos', value: counts.tributos },
        { label: 'A vencer', value: counts.tribVencer },
        { label: 'Vencidos', value: counts.tribVencidos },
      ],
      pendencias: counts.tribVencidos > 0 ? [`${counts.tribVencidos} tributo(s) vencido(s) - URGENTE`] : counts.tribVencer > 0 ? ['Verificar tributos a vencer'] : [],
    },
    {
      icon: Users, title: 'Gestão de Pessoal',
      status: counts.funcAtivos > 0 ? 'green' : 'yellow',
      summary: `${counts.funcAtivos} ativos · Folha: ${formatCurrency(counts.folhaAtual)}`,
      details: [
        { label: 'Funcionários ativos', value: counts.funcAtivos },
        { label: 'Folha do mês', value: formatCurrency(counts.folhaAtual) },
      ],
      pendencias: counts.funcAtivos === 0 ? ['Cadastrar funcionários'] : [],
    },
    {
      icon: BarChart3, title: 'Fluxo de Caixa',
      status: counts.saldoProjetado < 0 ? 'red' : counts.fluxoTotal > 0 ? 'green' : 'yellow',
      summary: `Saldo projetado: ${formatCurrency(counts.saldoProjetado)}`,
      details: [
        { label: 'Movimentações registradas', value: counts.fluxoTotal },
        { label: 'Saldo em 30 dias', value: formatCurrency(counts.saldoProjetado) },
      ],
      pendencias: counts.saldoProjetado < 0 ? ['Saldo projetado negativo - revisar entradas/saídas'] : [],
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader title="Mapa Geral" subtitle="Visão consolidada de todos os módulos" />

      {/* Progress */}
      <div className="bg-card rounded-xl border p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Progresso de Migração Base44</p>
          <span className="text-sm font-bold text-primary">{modules.filter(m => m.status === 'green').length}/{modules.length} módulos</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div className="bg-green-500 rounded-full h-3 transition-all" style={{ width: `${(modules.filter(m => m.status === 'green').length / modules.length) * 100}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {modules.map((m, i) => <ModuleCard key={i} {...m} />)}
      </div>
    </div>
  );
}