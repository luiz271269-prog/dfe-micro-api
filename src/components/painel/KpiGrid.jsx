import { Landmark, BarChart3, TrendingUp, Database, FileText, CalendarClock, ShieldCheck, Target } from 'lucide-react';
import KpiCard from './KpiCard';
import { formatCurrency } from '@/lib/formatters';
import { variacao } from '@/hooks/useFluxoConsolidado';

export default function KpiGrid({ dados, onDrill }) {
  const { executivo: e, aberto, posicao, historico = [], operacao } = dados;
  const ant = historico.length >= 2 ? historico[historico.length - 2] : null;
  const ad = aberto.adimplencia;
  const rec = aberto.aReceber, pag = aberto.aPagar;
  // Loop-R: fonte crítica indisponível → KPI afetado exibe DADOS INCOMPLETOS, nunca um total que parece normal.
  const ok = (...fontes) => fontes.every((f) => dados.sourceStatus?.[f]?.status === 'carregada');
  const inc = (...fontes) => (ok(...fontes) ? {} : { texto: 'Dados incompletos', variacao: undefined });
  const FAT = ['NotaFiscal', 'IntegracaoFinanceira'];
  const OPER = [...FAT, 'ItemCompra', 'Tributo', 'FolhaPagamento', 'DespesaOperacional', 'ObraReforma'];
  const CAIXA = ['LancamentoBancario', 'VinculoExtrato', 'TransferenciaInterna'];
  const PAGAR = ['Tributo', 'DespesaOperacional', 'FolhaPagamento', 'ItemCompra', 'FaturaCartao'];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <KpiCard titulo="Saldo Atual (Consolidado)" valor={e.saldoAtual} texto={e.saldoAtual == null ? 'Não verificável' : undefined} icon={Landmark} tom="blue"
        variacao={variacao(e.saldoAtual, ant?.saldoFinal)} sub={`${posicao.porConta.length} conta(s) · saldo do extrato`} href="/extrato" {...inc('LancamentoBancario')} />
      <KpiCard titulo="Faturamento do Mês" valor={e.faturamento} icon={BarChart3} tom="green" variacao={variacao(e.faturamento, ant?.faturamento)}
        sub="Produtos, serviços, locações" onClick={() => onDrill(operacao.faturamento.componentes.vendasNF)} {...inc(...FAT)} />
      <KpiCard titulo="Resultado da Operação" valor={e.resultadoOperacao} icon={TrendingUp} tom="orange" variacao={variacao(e.resultadoOperacao, ant?.resultadoOperacao)}
        sub={e.margemOperacional != null ? `${e.margemOperacional}% do faturamento` : 'Sem faturamento no mês'} {...inc(...OPER)} />
      <KpiCard titulo="Resultado de Caixa" valor={e.resultadoCaixa} icon={Database} tom="purple" variacao={variacao(e.resultadoCaixa, ant?.resultadoCaixa)}
        sub="Após retiradas e investimentos" {...inc(...CAIXA)} />
      <KpiCard titulo="A Receber (Carteira)" valor={rec.total} icon={FileText} tom="amber"
        sub={`A vencer: ${formatCurrency(rec.aVencer, true)} · Vencido: ${formatCurrency(rec.vencido, true)}`} href="/cobrancas" {...inc('TituloCobranca')} />
      <KpiCard titulo="A Pagar (Obrigações)" valor={pag.total} icon={CalendarClock} tom="red"
        sub={`A vencer: ${formatCurrency(pag.aVencer, true)} · Vencido: ${formatCurrency(pag.vencido, true)}`} href="/contas-a-pagar" {...inc(...PAGAR)} />
      <KpiCard titulo="Adimplência" texto={ad.percentual != null ? `${ad.percentual}%` : '—'} icon={ShieldCheck} tom="sky"
        sub={ad.total ? `${ad.pagos} de ${ad.total} títulos vencidos no mês` : 'Nenhum título vencido no mês'} href="/cobrancas" {...inc('TituloCobranca')} />
      <KpiCard titulo="Custos Fixos" valor={e.custosFixos} icon={Target} tom="violet" variacao={variacao(e.custosFixos, ant?.custosFixos)} negativoRuim={false}
        sub="Despesas recorrentes + folha" onClick={() => onDrill(operacao.folha)} {...inc('DespesaOperacional', 'FolhaPagamento')} />
    </div>
  );
}