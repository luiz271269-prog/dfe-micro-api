import { classificarNaturezaBancaria, sugestaoCorrecao } from '@/lib/naturezaCreditoExtrato';

const ESTILO = {
  aplicacao: ['Aplicação financeira', 'bg-violet-100 text-violet-700'],
  resgate: ['Resgate de aplicação', 'bg-indigo-100 text-indigo-700'],
  transferencia: ['Transferência interna', 'bg-slate-200 text-slate-700'],
  receita: ['Receita', 'bg-emerald-100 text-emerald-700'],
  receita_sugerida: ['Receita sugerida', 'bg-emerald-50 text-emerald-700 border border-emerald-200'],
  credito_revisar: ['Crédito a revisar', 'bg-amber-100 text-amber-800'],
  debito_revisar: ['Natureza a revisar', 'bg-amber-100 text-amber-800'],
  despesa_em_receita: ['Débito lançado como receita', 'bg-amber-100 text-amber-800'],
};

export default function NaturezaMovimentoBadge({ lancamento, rotuloCategoria }) {
  const { natureza } = classificarNaturezaBancaria(lancamento);
  const sugerida = sugestaoCorrecao(lancamento, rotuloCategoria);

  let chave = null;
  if (natureza === 'aplicacao' || natureza === 'resgate' || natureza === 'transferencia') chave = natureza;
  else if (natureza === 'receita') chave = lancamento.categoria === 'recebimento' ? 'receita' : (sugerida ? 'receita_sugerida' : null);
  else if (natureza === 'credito_revisar') chave = 'credito_revisar';
  else if (natureza === 'debito_revisar') chave = 'debito_revisar';
  else if (natureza === 'despesa' && lancamento.categoria === 'recebimento') chave = 'despesa_em_receita';

  if (!chave) return null;
  const [rotulo, cls] = ESTILO[chave];
  return <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{rotulo}</span>;
}