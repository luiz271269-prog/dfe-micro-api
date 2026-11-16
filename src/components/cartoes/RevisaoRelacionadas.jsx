import { useEffect, useState } from 'react';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import { formatCurrency } from '@/lib/formatters';

const ESCOPOS = [['parcelas', 'Outras parcelas desta compra'], ['mesmo_mes', 'Outras compras neste mês'], ['outros_meses', 'Compras em outros meses']];
const periodo = meses => meses.length > 3 ? `${meses[0]} a ${meses[meses.length - 1]}` : meses.join(', ');

// Informa, sem pedir confirmação, quais parcelas e demais compras do estabelecimento recebem a mesma classificação ao salvar.
export default function RevisaoRelacionadas({ grupo }) {
  const [analise, setAnalise] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    revisarTiposGasto({ action: 'analisar_relacionadas_revisao', grupo }).then(({ data }) => { if (active) setAnalise(data); }).catch(e => { if (active) setError(e.response?.data?.error || e.message); });
    return () => { active = false; };
  }, []);
  if (error) return <p role="alert" className="text-xs text-destructive">Não foi possível analisar as outras compras deste estabelecimento: {error}</p>;
  if (!analise) return <p role="status" className="text-xs text-muted-foreground">Analisando parcelas e outras compras deste estabelecimento...</p>;
  const aplicados = ESCOPOS.filter(([k]) => analise.escopos[k].quantidade > 0 && (k === 'parcelas' || !analise.generico));
  const total = aplicados.reduce((s, [k]) => s + analise.escopos[k].quantidade, 0);
  return <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
    <p className="font-medium text-sm">{total ? `Ao salvar, vale também para mais ${total} lançamento(s) deste estabelecimento` : 'Nenhuma outra parcela ou compra deste estabelecimento foi encontrada'}</p>
    {analise.parcela && <p className="text-muted-foreground">Compra parcelada: parcela {analise.parcela} nesta fatura.</p>}
    {aplicados.map(([k, rotulo]) => { const e = analise.escopos[k]; return <p key={k}><span className="font-medium">{rotulo}:</span> <span className="text-muted-foreground">{e.quantidade} lançamento(s) · {formatCurrency(e.valor)} · {periodo(e.meses)} · {e.cartoes.join(', ')}{e.classificacoes > 1 ? ` · hoje com ${e.classificacoes} classificações diferentes` : ''}</span></p>; })}
    {analise.variacoes?.length > 0 && <p className="text-muted-foreground">Inclui o mesmo estabelecimento escrito de outra forma: {analise.variacoes.join(', ')}.</p>}
    {analise.generico && <p className="text-warning">Marketplace genérico: o mesmo nome reúne compras diferentes, por isso só as parcelas desta compra recebem a classificação.</p>}
    {total > analise.limite && <p className="text-warning">São alteradas até {analise.limite} outras compras por vez. Salve de novo para concluir as restantes.</p>}
  </div>;
}