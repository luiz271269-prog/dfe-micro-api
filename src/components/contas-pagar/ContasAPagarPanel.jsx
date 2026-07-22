import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Wallet, Landmark, Users, CreditCard, ShoppingCart, AlertTriangle, CheckCircle, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { consolidarContasPagar, calcularAging, executarBaixaAutomatica } from '../../lib/contasPagarEngine';
import CalendarioSemanal from './CalendarioSemanal';
import PainelDDA from './PainelDDA';
import FluxoContasAPagar from './FluxoContasAPagar';

const ORIGEM_CONFIG = {
  despesa: { icon: Wallet,     color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Despesa', href: '/despesas' },
  tributo: { icon: Landmark,   color: 'bg-orange-100 text-orange-700 border-orange-200',   label: 'Tributo', href: '/tributos' },
  folha:   { icon: Users,      color: 'bg-indigo-100 text-indigo-700 border-indigo-200',   label: 'Folha',   href: '/funcionarios' },
  fatura:  { icon: CreditCard, color: 'bg-purple-100 text-purple-700 border-purple-200',   label: 'Cartão',  href: '/cartoes' },
  compra:  { icon: ShoppingCart, color: 'bg-sky-100 text-sky-700 border-sky-200',          label: 'Compra',  href: '/compras' },
};

function mesAtualISO() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function deslocarMes(mesIso, delta) {
  const [y, m] = mesIso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function rotuloMes(mesIso) {
  const [y, m] = mesIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function ContasAPagarPanel() {
  const [loading, setLoading] = useState(true);
  const [conciliando, setConciliando] = useState(false);
  const [resultadoBaixa, setResultadoBaixa] = useState(null);
  const [filtroOrigem, setFiltroOrigem] = useState('todos');
  const [filtroEmpresa, setFiltroEmpresa] = useState('todos');
  const [mesReferencia, setMesReferencia] = useState(mesAtualISO());
  const [dados, setDados] = useState({ despesas: [], tributos: [], folhas: [], faturas: [], cartoes: [], compras: [] });
  const [vinculos, setVinculos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);

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

  async function load() {
    setLoading(true);
    const [despesas, tributos, folhas, faturas, cartoes, compras, vincs, lancs] = await Promise.all([
      base44.entities.DespesaOperacional.list('-data_vencimento', 500),
      base44.entities.Tributo.list('-data_vencimento', 200),
      base44.entities.FolhaPagamento.list('-competencia', 500),
      base44.entities.FaturaCartao.list('-data_vencimento', 200),
      base44.entities.ContaCartao.filter({ is_ativo: true }),
      base44.entities.ItemCompra.list('-data_emissao', 1000),
      base44.entities.VinculoExtrato.list('-created_date', 5000),
      base44.entities.LancamentoBancario.list('-data', 1000),
    ]);
    setDados({ despesas, tributos, folhas, faturas, cartoes, compras });
    setVinculos(vincs);
    setLancamentos(lancs);
    setLoading(false);
  }
  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('neuralfinRefresh', handler);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const p = localStorage.getItem('neuralfinPendingRefresh');
        if (p) {
          localStorage.removeItem('neuralfinPendingRefresh');
          load();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('neuralfinRefresh', handler);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const itensRaw = useMemo(() => consolidarContasPagar(dados), [dados]);
  const itens = useMemo(() => {
    return itensRaw.filter(i => {
      if (filtroOrigem !== 'todos' && i.origem_tipo !== filtroOrigem) return false;
      if (filtroEmpresa !== 'todos' && i.empresa !== filtroEmpresa) return false;
      return true;
    });
  }, [itensRaw, filtroOrigem, filtroEmpresa]);

  const aging = useMemo(() => calcularAging(itens), [itens]);

  // Set de itens já conciliados (têm VinculoExtrato apontando)
  const conciliadosSet = useMemo(() => {
    const m = { despesa: 'DespesaOperacional', tributo: 'Tributo', folha: 'FolhaPagamento', fatura: 'FaturaCartao', compra: 'ItemCompra' };
    const s = new Set();
    vinculos.forEach(v => s.add(`${v.entidade_tipo}-${v.entidade_id}`));
    return { has: (item) => s.has(`${m[item.origem_tipo]}-${item.origem_id}`) };
  }, [vinculos]);

  const total = itens.reduce((a, i) => a + (i.valor || 0), 0);
  const totalVencido = aging.vencidos.reduce((a, i) => a + (i.valor || 0), 0);
  const totalSemana = [...aging.hoje, ...aging.semana].reduce((a, i) => a + (i.valor || 0), 0);
  const totalMes = [...aging.hoje, ...aging.semana, ...aging.ate15, ...aging.ate30].reduce((a, i) => a + (i.valor || 0), 0);

  const totaisPorOrigem = useMemo(() => {
    const t = { despesa: 0, tributo: 0, folha: 0, fatura: 0, compra: 0 };
    itensRaw.forEach(i => { t[i.origem_tipo] = (t[i.origem_tipo] || 0) + i.valor; });
    return t;
  }, [itensRaw]);

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;

  return (
    <>
      {/* Header da aba — ações */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <Button onClick={executarBaixa} disabled={conciliando} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          {conciliando ? (
            <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Conciliando...</>
          ) : (
            <><Zap className="w-3.5 h-3.5" /> Baixa Automática</>
          )}
        </Button>
        <Button variant="outline" onClick={load} size="sm">Atualizar</Button>
      </div>

      {resultadoBaixa && (
        <div className={`rounded-xl p-3 mb-4 border ${resultadoBaixa.erro ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {resultadoBaixa.erro ? (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4" /> Erro: {resultadoBaixa.erro}
            </div>
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

      <FluxoContasAPagar faturas={dados.faturas} cartoes={dados.cartoes} lancamentos={lancamentos} mesReferencia={mesReferencia} />

      {/* Totais principais — linha compacta de KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        <div className="bg-gradient-to-br from-slate-700 to-slate-900 text-white rounded-xl px-3 py-2 shadow" title={`${itens.length} itens em aberto`}>
          <p className="text-[10px] font-bold uppercase opacity-80">Total a pagar</p>
          <p className="text-xl font-bold">{formatCurrency(total)}</p>
        </div>
        <div className="bg-red-50 rounded-xl px-3 py-2 border border-red-200" title={`${aging.vencidos.length} item(ns) em atraso`}>
          <p className="text-[10px] font-bold uppercase text-red-700">Vencido</p>
          <p className="text-lg font-bold text-red-700">{formatCurrency(totalVencido)}</p>
        </div>
        <div className="bg-orange-50 rounded-xl px-3 py-2 border border-orange-200" title={`${aging.hoje.length + aging.semana.length} item(ns)`}>
          <p className="text-[10px] font-bold uppercase text-orange-700">Próximos 7 dias</p>
          <p className="text-lg font-bold text-orange-700">{formatCurrency(totalSemana)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl px-3 py-2 border border-blue-200" title="Projeção de desembolso">
          <p className="text-[10px] font-bold uppercase text-blue-700">Este mês (30d)</p>
          <p className="text-lg font-bold text-blue-700">{formatCurrency(totalMes)}</p>
        </div>
      </div>

      {/* Filtro por origem — grade compacta */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        <button onClick={() => setFiltroOrigem('todos')} title={`${itensRaw.length} itens`}
          className={`rounded-lg border px-3 py-2 text-left transition-all ${filtroOrigem === 'todos' ? 'ring-2 ring-primary bg-primary/5' : 'bg-card hover:bg-muted/30'}`}>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Todas as origens</p>
          <p className="text-sm font-bold">{formatCurrency(itensRaw.reduce((a,i)=>a+i.valor,0))}</p>
        </button>
        {Object.entries(ORIGEM_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const qtd = itensRaw.filter(i => i.origem_tipo === key).length;
          return (
            <button key={key} onClick={() => setFiltroOrigem(key)} title={`${qtd} item(ns)`}
              className={`rounded-lg border px-3 py-2 text-left transition-all ${filtroOrigem === key ? 'ring-2 ring-primary bg-primary/5' : 'bg-card hover:bg-muted/30'}`}>
              <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" /> {cfg.label}</p>
              <p className="text-sm font-bold">{formatCurrency(totaisPorOrigem[key] || 0)}</p>
            </button>
          );
        })}
      </div>

      {/* Filtro empresa */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="font-bold text-muted-foreground">Empresa:</span>
        {['todos', 'NeuralTec', 'Liesch'].map(e => (
          <button key={e} onClick={() => setFiltroEmpresa(e)}
            className={`px-3 py-1 rounded-full border font-semibold ${filtroEmpresa === e ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}>
            {e === 'todos' ? 'Todas' : e}
          </button>
        ))}
      </div>

      {/* Seletor de mês para o calendário */}
      <div className="flex items-center justify-between gap-2 mb-3 bg-card border rounded-xl px-3 py-2">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setMesReferencia(deslocarMes(mesReferencia, -1))}>
          <ChevronLeft className="w-4 h-4" /> Mês anterior
        </Button>
        <span className="font-bold text-sm capitalize">{rotuloMes(mesReferencia)}</span>
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setMesReferencia(deslocarMes(mesReferencia, 1))}>
          Próximo mês <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Duas colunas: Calendário (sistema) × DDA (banco) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CalendarioSemanal
          itens={itens}
          conciliadosSet={conciliadosSet}
          mesReferencia={mesReferencia}
        />
        <PainelDDA
          lancamentos={lancamentos}
          contasPagar={itensRaw}
          mesReferencia={mesReferencia}
        />
      </div>
    </>
  );
}