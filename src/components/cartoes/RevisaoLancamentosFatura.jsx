import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
export default function RevisaoLancamentosFatura({ item, rotulos }) {
  const [open, setOpen] = useState(false), [pagina, setPagina] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const label = (eixo, valor) => rotulos[eixo]?.[valor] || valor || 'Não informado';
  async function carregar(cursor, active = () => true) {
    setLoading(true); setError('');
    const condicoes = ['origem_compra', 'tipo_compra'].map(campo => item.atual[campo] ? { [campo]: item.atual[campo] } : { $or: [{ [campo]: '' }, { [campo]: null }, { [campo]: { $exists: false } }] });
    try {
      const data = await base44.entities.LancamentoCartao.filter({ fatura_id: item.fatura_id, estabelecimento: item.estabelecimento, valor: { $gt: 0 }, observacao: { $not: { $regex: 'Não faz parte', $options: 'i' } }, $and: condicoes }, { sort: 'data_lancamento', limit: 50, ...(cursor ? { cursor } : {}), fields: ['data_lancamento', 'estabelecimento', 'observacao', 'valor', 'origem_compra', 'tipo_compra', 'categoria', 'natureza'] });
      if (active()) setPagina(prev => cursor ? { ...data, items: [...prev.items, ...data.items] } : data);
    } catch (e) { if (active()) setError(e.message || 'Não foi possível consultar os lançamentos.'); }
    finally { if (active()) setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    if (open) { setPagina(null); carregar(undefined, () => active); }
    return () => { active = false; };
  }, [open, item]);
  return <tr className="border-b"><td colSpan={5} className="pb-3">
    <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Ocultar lançamentos' : 'Ver dados da fatura e classificação salva'}</Button>
    {open && <div className="border rounded-lg bg-muted/20 p-3 space-y-2">
      <p className="text-xs text-muted-foreground">Dados como foram importados nesta fatura. Parcelas e detalhes são exibidos quando constam na descrição ou observação; a sugestão acima não é uma classificação salva.</p>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {loading && <p role="status">Carregando lançamentos...</p>}
      {pagina && <div className="overflow-x-auto"><table className="w-full text-xs text-left">
        <thead><tr className="border-b text-muted-foreground"><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Descrição / parcela importada</th><th className="py-2 pr-3">Valor</th><th className="py-2 pr-3">Quem comprou salvo</th><th className="py-2 pr-3">Tipo salvo</th><th className="py-2 pr-3">Categoria salva</th><th className="py-2">Natureza salva</th></tr></thead>
        <tbody>{pagina.items.map(l => <tr key={l.id} className="border-b align-top">
          <td className="py-2 pr-3 whitespace-nowrap">{formatDate(l.data_lancamento)}</td>
          <td className="py-2 pr-3"><p className="whitespace-pre-wrap">{l.estabelecimento}</p>{l.observacao && <p className="text-muted-foreground whitespace-pre-wrap">{l.observacao}</p>}</td>
          <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{formatCurrency(l.valor)}</td>
          <td className="py-2 pr-3">{label('origem', l.origem_compra)}</td><td className="py-2 pr-3">{label('tipo', l.tipo_compra)}</td><td className="py-2 pr-3">{label('categoria', l.categoria)}</td><td className="py-2">{l.natureza || 'Não informado'}</td>
        </tr>)}</tbody>
      </table>{!pagina.items.length && <p className="py-2">Nenhum lançamento corresponde ao grupo atual. Atualize a revisão.</p>}</div>}
      {pagina?.has_more && <Button size="sm" variant="outline" disabled={loading} onClick={() => carregar(pagina.next_cursor)}>Carregar mais lançamentos</Button>}
      {error && <Button size="sm" variant="outline" disabled={loading} onClick={() => carregar()}>Tentar novamente</Button>}
    </div>}
  </td></tr>;
}