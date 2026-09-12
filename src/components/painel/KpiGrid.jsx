import { Landmark, BarChart3, TrendingUp, Database, FileText, CalendarClock, ShieldCheck, Target } from 'lucide-react';
import KpiCard from './KpiCard';
import { formatCurrency } from '@/lib/formatters';
import { variacao } from '@/hooks/useFluxoConsolidado';

export default function KpiGrid({ dados, onDrill }) {
  const { executivo: e, aberto, posicao, historico = [], operacao } = dados;
  const ant = historico.length >= 2 ? historico[historico.length - 2] : null;
  const ad = aberto.adimplencia;
  const rec = aberto.aReceber, pag = aberto.aPagar;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <KpiCard titulo="Saldo Atual (Consolidado)" valor={e.saldoAtual} texto={e.saldoAtual == null ? 'Não verificável' : undefined} icon={Landmark} tom="blue"
        variacao={variacao(e.saldoAtual, ant?.saldoFinal)} sub={`${posicao.porConta.length} conta(s) · saldo do extrato`} href="/extrato" />
      <KpiCard titulo="Faturamento do Mês" valor={e.faturamento} icon={BarChart3} tom="green" variacao={variacao(e.faturamento, ant?.faturamento)}
        sub="Produtos, serviços, locações" onClick={() => onDrill(operacao.faturamento.componentes.vendasNF)} />
      <KpiCard titulo="Resultado da Operação" valor={e.resultadoOperacao} icon={TrendingUp} tom="orange" variacao={variacao(e.resultadoOperacao, ant?.resultadoOperacao)}
        sub={e.margemOperacional != null ? `${e.margemOperacional}% do faturamento` : 'Sem faturamento no mês'} />
      <KpiCard titulo="Resultado de Caixa" valor={e.resultadoCaixa} icon={Database} tom="purple" variacao={variacao(e.resultadoCaixa, ant?.resultadoCaixa)}
        sub="Após retiradas e investimentos" />
      <KpiCard titulo="A Receber (Carteira)" valor={rec.total} icon={FileText} tom="amber"
        sub={`A vencer: ${formatCurrency(rec.aVencer, true)} · Vencido: ${formatCurrency(rec.vencido, true)}`} href="/cobrancas" />
      <KpiCard titulo="A Pagar (Obrigações)" valor={pag.total} icon={CalendarClock} tom="red"
        sub={`A vencer: ${formatCurrency(pag.aVencer, true)} · Vencido: ${formatCurrency(pag.vencido, true)}`} href="/contas-a-pagar" />
      <KpiCard titulo="Adimplência" texto={ad.percentual != null ? `${ad.percentual}%` : '—'} icon={ShieldCheck} tom="sky"
        sub={ad.total ? `${ad.pagos} de ${ad.total} títulos vencidos no mês` : 'Nenhum título vencido no mês'} href="/cobrancas" />
      <KpiCard titulo="Custos Fixos" valor={e.custosFixos} icon={Target} tom="violet" variacao={variacao(e.custosFixos, ant?.custosFixos)} negativoRuim={false}
        sub="Despesas recorrentes + folha" onClick={() => onDrill(operacao.folha)} />
    </div>
  );
}