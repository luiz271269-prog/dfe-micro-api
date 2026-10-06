import { formatCurrency } from '@/lib/formatters';
const STATUS = { iguais: 'Igual ao mês anterior', divergentes: 'Revisar diferença', sem_historico: 'Sem correspondência no mês anterior', historico_inconsistente: 'Conferir: histórico incompleto, conflitante ou marketplace genérico' };
export default function RevisaoHistoricoLinhas({ itens, rotulos }) {
  const label = (eixo, chave) => rotulos[eixo]?.[chave] || chave || 'Não informado';
  function texto(c) { return [label('origem', c.origem_compra), label('tipo', c.tipo_compra), (c.categorias || [c.categoria]).map(k => label('categoria',k)).join(', ')].join(' · '); }
  return <div className="overflow-x-auto"><table className="w-full text-xs">
    <thead><tr className="border-b text-muted-foreground text-left"><th className="py-2 pr-3">Cartão / estabelecimento</th><th className="py-2 pr-3">Classificação salva</th><th className="py-2 pr-3">Sugestão do mês anterior</th><th className="py-2">Compras</th></tr></thead>
    <tbody>{itens.map((item, i) => <tr key={`${item.fatura_id}-${item.estabelecimento}-${i}`} className="border-b align-top">
      <td className="py-2 pr-3"><p className="font-medium">{item.estabelecimento}</p><p className="text-muted-foreground">{item.cartao}</p></td>
      <td className="py-2 pr-3"><p>{texto(item.atual)}</p>{item.pendente && <p className="text-warning">Quem comprou / tipo pendente</p>}</td>
      <td className="py-2 pr-3"><p className={item.status === 'divergentes' ? 'text-warning font-medium' : 'text-muted-foreground'}>{STATUS[item.status]}</p>{item.sugestao && <p>{texto(item.sugestao)}</p>}</td>
      <td className="py-2 whitespace-nowrap">{formatCurrency(item.valor)}<p className="text-muted-foreground">{item.quantidade} lançamento(s)</p></td>
    </tr>)}</tbody>
  </table></div>;
}