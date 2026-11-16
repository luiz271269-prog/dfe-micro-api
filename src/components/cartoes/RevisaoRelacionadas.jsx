import { useEffect, useState } from 'react';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/formatters';

const ESCOPOS = [['parcelas', 'Outras parcelas desta compra'], ['mesmo_mes', 'Outras compras deste estabelecimento neste mês'], ['outros_meses', 'Compras deste estabelecimento em outros meses']];
const periodo = meses => meses.length > 3 ? `${meses[0]} a ${meses[meses.length - 1]}` : meses.join(', ');

// Analisa parcelas e demais compras do mesmo estabelecimento e deixa o usuário escolher onde aplicar a mesma classificação.
export default function RevisaoRelacionadas({ grupo, disabled, onChange }) {
  const [analise, setAnalise] = useState(null), [marcados, setMarcados] = useState({}), [error, setError] = useState('');
  function emitir(dados, escolha) {
    const relacionadas = Object.fromEntries(ESCOPOS.filter(([k]) => escolha[k]).map(([k]) => [k, dados.escopos[k].quantidade]));
    onChange({ relacionadas, excedeu: Object.values(relacionadas).reduce((s, n) => s + n, 0) > dados.limite });
  }
  useEffect(() => {
    let active = true;
    revisarTiposGasto({ action: 'analisar_relacionadas_revisao', grupo }).then(({ data }) => {
      if (!active) return;
      const inicial = Object.fromEntries(ESCOPOS.map(([k]) => [k, data.escopos[k].quantidade > 0 && (k === 'parcelas' || (!data.generico && (k === 'mesmo_mes' || data.escopos[k].classificacoes <= 1)))]));
      setAnalise(data); setMarcados(inicial); emitir(data, inicial);
    }).catch(e => { if (active) { setError(e.response?.data?.error || e.message); onChange({ relacionadas: {}, excedeu: false }); } });
    return () => { active = false; };
  }, []);
  function alternar(escopo, valor) { const escolha = { ...marcados, [escopo]: valor === true }; setMarcados(escolha); emitir(analise, escolha); }
  if (error) return <p role="alert" className="text-xs text-destructive">Não foi possível analisar parcelas e outras compras deste estabelecimento ({error}). A classificação será salva só neste grupo.</p>;
  if (!analise) return <p role="status" className="text-xs text-muted-foreground">Analisando parcelas e outras compras deste estabelecimento...</p>;
  const encontrados = ESCOPOS.filter(([k]) => analise.escopos[k].quantidade > 0);
  const selecionadas = encontrados.filter(([k]) => marcados[k]).reduce((s, [k]) => s + analise.escopos[k].quantidade, 0);
  return <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
    <p className="font-medium text-sm">Mesma classificação para este estabelecimento</p>
    {analise.parcela && <p className="text-muted-foreground">Compra parcelada: parcela {analise.parcela} nesta fatura.</p>}
    {!encontrados.length && <p className="text-muted-foreground">Nenhuma outra parcela ou compra deste estabelecimento foi encontrada em outras faturas.</p>}
    {encontrados.map(([k, rotulo]) => { const e = analise.escopos[k]; return <label key={k} className="flex items-start gap-2">
      <Checkbox className="mt-0.5" checked={!!marcados[k]} disabled={disabled} onCheckedChange={v => alternar(k, v)} />
      <span><span className="font-medium">{rotulo}</span><span className="block text-muted-foreground">{e.quantidade} lançamento(s) · {formatCurrency(e.valor)} · {periodo(e.meses)} · {e.cartoes.join(', ')}{e.classificacoes > 1 ? ` · hoje com ${e.classificacoes} classificações diferentes` : ''}</span></span>
    </label>; })}
    {analise.generico && encontrados.length > 0 && <p className="text-warning">Marketplace genérico: o mesmo nome reúne compras diferentes, por isso só as parcelas vêm marcadas.</p>}
    {!analise.generico && analise.escopos.outros_meses.classificacoes > 1 && <p className="text-muted-foreground">Os outros meses vêm desmarcados porque essas compras têm hoje classificações diferentes entre si.</p>}
    {selecionadas > analise.limite && <p role="alert" className="text-destructive">Mais de {analise.limite} compras selecionadas. Desmarque os outros meses para salvar.</p>}
  </div>;
}