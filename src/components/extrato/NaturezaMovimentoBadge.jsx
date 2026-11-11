import { naturezaMovimento, creditoEmDespesaSemEvidencia } from '@/lib/naturezaCreditoExtrato';

const ESTILO = {
  aplicacao: ['Aplicação', 'bg-violet-100 text-violet-700'],
  resgate: ['Resgate', 'bg-indigo-100 text-indigo-700'],
  receita: ['Receita', 'bg-emerald-100 text-emerald-700'],
  revisar: ['Crédito em despesa · revisar', 'bg-amber-100 text-amber-800'],
};

export default function NaturezaMovimentoBadge({ lancamento, rotuloCategoria }) {
  const nat = naturezaMovimento(lancamento);
  const chave = nat === 'aplicacao' || nat === 'resgate' ? nat
    : nat === 'receita' && lancamento.categoria === 'recebimento' ? 'receita'
    : creditoEmDespesaSemEvidencia(lancamento, rotuloCategoria) || (nat === 'receita' && lancamento.tipo_compra === 'despesas') ? 'revisar' : null;
  if (!chave) return null;
  const [rotulo, cls] = ESTILO[chave];
  return <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{rotulo}</span>;
}