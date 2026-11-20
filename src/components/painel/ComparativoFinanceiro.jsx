import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import linhasComparativo from '@/components/painel/linhasComparativo';
import { fmtMes } from '@/components/shared/MonthNavigator';

export default function ComparativoFinanceiro({ data, consulta, mes, onDrill }) {
  const carteira = !consulta.error && consulta.data;
  const rows = linhasComparativo(data.operacao, data.caixa, carteira);
  if (carteira) rows.push({nome:'Total de contas a pagar',grupo:{confirmado:carteira.totalConfirmado,previsto:carteira.totalPrevisto}});
  const cell = (v, nome) => {
    if (v == null) return <span className="text-muted-foreground" aria-label="Não se aplica">—</span>;
    const n = typeof v === 'number' ? v : v.exibicao ?? v.valor;
    return v.registros > 0 ? <button className="inline-flex items-center gap-1 hover:underline" aria-label={`Ver detalhes: ${nome}, ${formatCurrency(n)}`} onClick={() => onDrill(v)}>{formatCurrency(n)}<ChevronRight size={13}/></button> : formatCurrency(n);
  };
  return <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm"><table className="w-full min-w-[720px] table-fixed text-sm xl:leading-tight">
    <caption className="sr-only">Comparativo financeiro de {fmtMes(mes)}, valores em reais</caption>
    <colgroup><col className="w-[36%]"/>{[1,2,3,4].map(i=><col key={i} className="w-[16%]"/>)}</colgroup>
    <thead className="bg-muted"><tr className="border-b"><th rowSpan={2} className="sticky left-0 bg-muted p-3 text-left xl:py-0">Descrição <small className="block font-normal text-muted-foreground">{fmtMes(mes)} · valores em R$</small></th><th rowSpan={2} className="border-l p-2 xl:py-0">Resultado da Operação</th><th rowSpan={2} className="border-l p-2 xl:py-0">Resultado de Caixa</th><th colSpan={2} className="border-l p-2 xl:py-0">Contas a Pagar por origem</th></tr>
    <tr className="border-b text-xs"><th className="border-l p-2 xl:py-0">Saldo em aberto</th><th className="p-2 xl:py-0">Previsão sem documento</th></tr></thead>
    <tbody>{rows.map(({nome,opValor,cxValor,grupo,nota}) => {
      const total = typeof opValor === 'number' || typeof cxValor === 'number' || nome === 'Total de contas a pagar';
      return <tr key={nome} className={`border-b last:border-0 ${total ? 'bg-muted font-semibold' : 'bg-card'}`}>
        <th scope="row" className={`sticky left-0 p-2 text-left xl:py-0 ${total ? 'bg-muted font-semibold' : 'bg-card pl-4 font-normal'}`}>{nome}{nota && <small className="block text-muted-foreground">{nota}</small>}</th>
        <td className="border-l text-center tabular-nums">{cell(opValor,nome)}</td><td className="border-l text-center tabular-nums">{cell(cxValor,nome)}</td>
        {['confirmado','previsto'].map(k=><td key={k} className="border-l text-center tabular-nums">{grupo?.href ? <Link to={grupo.href} className="hover:text-primary hover:underline">{cell(grupo[k],nome)}</Link> : cell(grupo?.[k],nome)}</td>)}
      </tr>;
    })}</tbody></table></div>;
}