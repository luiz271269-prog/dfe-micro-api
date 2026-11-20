import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import linhasComparativo from '@/components/painel/linhasComparativo';
import { fmtMes } from '@/components/shared/MonthNavigator';

export default function ComparativoFinanceiro({ data, consulta, mes, onDrill }) {
  const carteira = !consulta.error && consulta.data;
  const blocos = linhasComparativo(data.operacao, data.caixa, carteira);
  const estadoCarteira = consulta.error ? 'Consulta indisponível. Consulte as notas abaixo.'
    : consulta.isLoading ? 'Consultando contas a pagar…' : 'Nenhum saldo disponível nesta consulta.';
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
    {blocos.map(({ id, titulo, contexto, coluna, largura, linhas }) => <tbody key={id} className="border-t-2">
      <tr className="border-b bg-secondary">
        <th scope="rowgroup" className="sticky left-0 bg-secondary px-3 py-2 text-left">
          <span className="block font-bold">{titulo}</span>
          <small className="block font-normal text-muted-foreground">{contexto}</small>
        </th>
        <td colSpan={4} />
      </tr>
      {linhas.map(({ nome, valores, href, nota, subtotal }) => <tr key={nome} className={`border-b last:border-b-0 ${subtotal ? 'bg-muted font-semibold' : 'bg-card'}`}>
        <th scope="row" className={`sticky left-0 px-3 py-1 text-left xl:py-0.5 ${subtotal ? 'bg-muted font-semibold' : 'bg-card pl-5 font-normal'}`}>
          {nome}{nota && <small className="block text-muted-foreground">{nota}</small>}
        </th>
        {Array.from({ length: 4 }, (_, i) => {
          const aplicavel = i >= coluna && i < coluna + largura;
          const valor = valores[i - coluna];
          return <td key={i} className="border-l px-2 text-right tabular-nums">{aplicavel && (
            href && valor != null ? <Link to={href} className="hover:text-primary hover:underline">{cell(valor, nome)}</Link> : cell(valor, nome)
          )}</td>;
        })}
      </tr>)}
      {!linhas.length && <tr><td colSpan={5} className="px-3 py-2 text-xs text-muted-foreground">{estadoCarteira}</td></tr>}
    </tbody>)}
    </table></div>;
}