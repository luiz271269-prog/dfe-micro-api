import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Wallet, Landmark, Users, CreditCard, ShoppingCart, Hammer, Briefcase, AlertTriangle, CheckCircle, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { consolidarContasPagar, calcularAging, contarEvaporados } from '../../lib/contasPagarEngine';
import CalendarioSemanal from './CalendarioSemanal';
import PainelDDA from './PainelDDA';
import FluxoContasAPagar from './FluxoContasAPagar';
import SincronizarComprasButton from './SincronizarComprasButton';
import PainelComprasImportadas from './PainelComprasImportadas';
import ChipsStatusContas from './ChipsStatusContas';
import { consolidarContasPagas } from '../../lib/contasPagasEngine';
import LancarDespesaFotoButton from '../despesas/LancarDespesaFotoButton';
import MonthNavigator from '../shared/MonthNavigator';
import FiltroTiposGasto from '@/components/classificacao/FiltroTiposGasto';
import RevisaoTiposGasto from '@/components/classificacao/RevisaoTiposGasto';
import { tipoGastoValido } from '@/lib/classificacaoUnificada';



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
  const [filtroStatus, setFiltroStatus] = useState('todos'); // todos · aberto · semana · vencidos · pagos
  const modo = filtroStatus === 'pagos' ? 'pagos' : 'aberto';
  const [filtroOrigem, setFiltroOrigem] = useState('todos');
  const [filtroEmpresa, setFiltroEmpresa] = useState('todos');
  const [mesReferencia, setMesReferencia] = useState(mesAtualISO());
  const [dados, setDados] = useState({ despesas: [], tributos: [], folhas: [], faturas: [], cartoes: [], compras: [], obras: [], lancamentos: [], lancamentosCartao: [] });
  const [vinculos, setVinculos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);

  // Baixa automática unificada — roda no backend (conciliarContasAPagarExtrato),
  // cobrindo despesa, compra, obra, tributo e fatura numa única implementação.
  async function executarBaixa() {
    if (conciliando) return;
    setConciliando(true);
    setResultadoBaixa(null);
    try {
      const { data } = await base44.functions.conciliarContasAPagarExtrato({});
      if (data?.error) throw new Error(data.error);
      setResultadoBaixa(data);
      await load();
      window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (err) {
      setResultadoBaixa({ erro: err.message });
    }
    setConciliando(false);
  }

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    const [despesas, tributos, folhas, faturas, cartoes, compras, obras, lancsCartao, vincs, lancs] = await Promise.all([
      base44.entities.DespesaOperacional.list('-data_vencimento', 500),
      base44.entities.Tributo.list('-data_vencimento', 200),
      base44.entities.FolhaPagamento.list('-competencia', 500),
      base44.entities.FaturaCartao.list('-data_vencimento', 200),
      base44.entities.ContaCartao.filter({ is_ativo: true }),
      base44.entities.ItemCompra.list('-data_emissao', 1000),
      base44.entities.ObraReforma.list('-data', 500),
      base44.entities.LancamentoCartao.list('-data_lancamento', 3000),
      base44.entities.VinculoExtrato.list('-created_date', 5000),
      base44.entities.LancamentoBancario.list('-data', 1000),
    ]);
    setDados({ despesas, tributos, folhas, faturas, cartoes, compras, obras, lancamentos: lancs, lancamentosCartao: lancsCartao });
    setVinculos(vincs);
    setLancamentos(lancs);
    setLoading(false);
  }
  useEffect(() => {
    load();
    const handler = () => load(false);
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

  const abertosRaw = useMemo(() => consolidarContasPagar(dados), [dados]);
  // Pagos: o eixo temporal passa a ser a emissão do documento
  const pagosRaw = useMemo(
    () => consolidarContasPagas(dados).map(i => ({ ...i, data_vencimento: i.data_emissao })),
    [dados]
  );

  const contagens = useMemo(() => {
    const ag = calcularAging(abertosRaw);
    return {
      todos: abertosRaw.length + pagosRaw.length,
      aberto: abertosRaw.length,
      semana: ag.hoje.length + ag.semana.length,
      vencidos: ag.vencidos.length,
      pagos: pagosRaw.length,
    };
  }, [abertosRaw, pagosRaw]);

  const itensRaw = useMemo(() => {
    if (filtroStatus === 'pagos') return pagosRaw;
    if (filtroStatus === 'todos') return [...abertosRaw, ...pagosRaw];
    const ag = calcularAging(abertosRaw);
    if (filtroStatus === 'semana') return [...ag.hoje, ...ag.semana];
    if (filtroStatus === 'vencidos') return ag.vencidos;
    return abertosRaw;
  }, [abertosRaw, pagosRaw, filtroStatus]);
  const itens = useMemo(() => {
    return itensRaw.filter(i => {
      const tipo = i.origem_tipo === 'fatura' ? 'fatura' : tipoGastoValido(i.tipo_compra) ? i.tipo_compra : 'pendente';
      if (filtroOrigem !== 'todos' && tipo !== filtroOrigem) return false;
      if (filtroEmpresa !== 'todos' && i.empresa !== filtroEmpresa) return false;
      return true;
    });
  }, [itensRaw, filtroOrigem, filtroEmpresa]);

  const aging = useMemo(() => calcularAging(itens), [itens]);

  // Set de itens já conciliados (têm VinculoExtrato apontando)
  const conciliadosSet = useMemo(() => {
    const m = { despesa: 'DespesaOperacional', tributo: 'Tributo', folha: 'FolhaPagamento', fatura: 'FaturaCartao', compra: 'ItemCompra', obra: 'ObraReforma' };
    const s = new Set();
    vinculos.forEach(v => s.add(`${v.entidade_tipo}-${v.entidade_id}`));
    return { has: (item) => s.has(`${m[item.origem_tipo]}-${item.origem_id}`) };
  }, [vinculos]);

  const total = itens.reduce((a, i) => a + (i.valor || 0), 0);
  const totalVencido = aging.vencidos.reduce((a, i) => a + (i.valor || 0), 0);
  const totalSemana = [...aging.hoje, ...aging.semana].reduce((a, i) => a + (i.valor || 0), 0);
  const totalMes = [...aging.hoje, ...aging.semana, ...aging.ate15, ...aging.ate30].reduce((a, i) => a + (i.valor || 0), 0);



  const evaporados = useMemo(() => contarEvaporados(dados), [dados]);

  // Totais por mês de vencimento — alimentam a barra de meses (inclui meses futuros)
  const totaisPorMes = useMemo(() => {
    const t = {};
    itensRaw.forEach((i) => {
      const m = (i.data_vencimento || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(m)) t[m] = (t[m] || 0) + (i.valor || 0);
    });
    return t;
  }, [itensRaw]);

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;

  return (
    <>
      {/* Header da aba — ações */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <ChipsStatusContas status={filtroStatus} onChange={(s) => { setFiltroStatus(s); setFiltroOrigem('todos'); }} contagens={contagens} />
        <div className="flex items-center gap-2 flex-wrap">
        <RevisaoTiposGasto />
        <LancarDespesaFotoButton onSaved={load} />
        <SincronizarComprasButton onDone={load} />
        {modo === 'aberto' && <Button onClick={executarBaixa} disabled={conciliando} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          {conciliando ? (
            <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Conciliando...</>
          ) : (
            <><Zap className="w-3.5 h-3.5" /> Baixa Automática</>
          )}
        </Button>}
        <Button variant="outline" onClick={load} size="sm">Atualizar</Button>
        </div>
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
                <span className="font-semibold">{resultadoBaixa.baixas_automaticas || 0} conta(s) baixada(s) automaticamente</span>
                <span className="text-xs opacity-80">· {resultadoBaixa.sugestoes_criadas || 0} sugestão(ões) · {resultadoBaixa.total_debitos_analisados || 0} débitos analisados · {resultadoBaixa.total_contas_abertas || 0} contas em aberto</span>
              </div>
              <button onClick={() => setResultadoBaixa(null)} className="text-xs opacity-70 hover:opacity-100">×</button>
            </div>
          )}
        </div>
      )}

      <FluxoContasAPagar faturas={dados.faturas} cartoes={dados.cartoes} lancamentos={lancamentos} mesReferencia={mesReferencia} evaporados={evaporados} />

      <PainelComprasImportadas compras={dados.compras} />

      {/* Totais principais — linha compacta de KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        <div className="bg-gradient-to-br from-slate-700 to-slate-900 text-white rounded-xl px-3 py-2 shadow" title={`${itens.length} itens`}>
          <p className="text-[10px] font-bold uppercase opacity-80">{modo === 'aberto' ? 'Total a pagar' : 'Total pago'}</p>
          <p className="text-xl font-bold">{formatCurrency(total)}</p>
        </div>
        {modo === 'pagos' ? (
          <div className="bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-200 lg:col-span-3" title="Obrigações já liquidadas, agrupadas pela data de emissão do documento">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Itens liquidados</p>
            <p className="text-lg font-bold text-emerald-700">{itens.length} item(ns)</p>
          </div>
        ) : (<>
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
        </>)}
      </div>

      <FiltroTiposGasto itens={itensRaw.filter(i => filtroEmpresa === 'todos' || i.empresa === filtroEmpresa)} value={filtroOrigem} onChange={setFiltroOrigem} />

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
      <div className="mb-3 bg-card border rounded-xl px-3 py-2">
        <MonthNavigator selectedMonth={mesReferencia} onSelectMonth={setMesReferencia} monthTotals={totaisPorMes} />
      </div>

      {/* Duas colunas: Calendário (sistema) × DDA (banco) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CalendarioSemanal
          itens={itens}
          conciliadosSet={conciliadosSet}
          mesReferencia={mesReferencia}
          modo={modo}
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