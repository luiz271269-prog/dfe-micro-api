import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { consultarComposicaoFatura } from '@/functions/consultarComposicaoFatura';
import { formatCurrency } from '@/lib/formatters';
import CartoesTotaisLinhas from '@/components/cartoes/CartoesTotaisLinhas';
import CartoesTabelaAcoes from '@/components/cartoes/CartoesTabelaAcoes';

export default function CartoesTotaisTabela({ fatura, nome }) {
  const [cursores, setCursores] = useState([null]), [pagina, setPagina] = useState(0), [sort, setSort] = useState('data_lancamento');
  const [selecionados, setSelecionados] = useState([]);
  const consulta = useQuery({ queryKey: ['cartoes-totais-linhas', fatura.id, cursores[pagina], sort], queryFn: async () => {
    const { data } = await consultarComposicaoFatura({ fatura_id: fatura.id, cursor: cursores[pagina] || undefined, limit: 8, sort });
    if (data.error) throw new Error(data.error); return data;
  } });
  const r = consulta.data, linhas = r?.items || [];
  function ordenar(campo) { setSort(sort === campo ? `-${campo}` : campo); setPagina(0); setCursores([null]); setSelecionados([]); }
  function mover(proxima) { if (proxima > pagina) setCursores([...cursores.slice(0, pagina + 1), r.next_cursor]); setPagina(proxima); setSelecionados([]); }
  return <article className="dt1-card" data-dt1-bulk={selecionados.length ? 'on' : 'off'}>
    <div className="dt1-head"><div className="dt1-titles"><h3 className="dt1-title">{nome}</h3><p className="dt1-meta">{fatura.mes_referencia} · {fatura.liquidacao} · {r?.resumo.linhas ?? '…'} lançamentos</p></div></div>
    <p className="px-6 pb-3 text-xs text-muted-foreground">Fatura {formatCurrency(fatura.total)} · Pago considerado {formatCurrency(fatura.pago_considerado)} · Saldo {formatCurrency(fatura.saldo)}</p>
    <CartoesTabelaAcoes linhas={linhas} selecionados={selecionados} limpar={() => setSelecionados([])} nome={nome}/>
    <div className="dt1-tablewrap">
      {consulta.isPending ? <div role="status" className="dt1-skel">{Array.from({ length: 8 }, (_, i) => <div key={i} className="dt1-skel-row"/>)}<span className="sr-only">Carregando lançamentos</span></div> : consulta.isError ? <div role="alert" className="dt1-empty"><p>{consulta.error.message}</p><button className="dt1-btn" onClick={() => consulta.refetch()}>Tentar novamente</button></div> : <CartoesTotaisLinhas linhas={linhas} sort={sort} ordenar={ordenar} selecionados={selecionados} setSelecionados={setSelecionados}/>}
      {r && !linhas.length && <p className="dt1-empty">Nenhum lançamento importado nesta fatura.</p>}
    </div>
    <div className="dt1-foot"><p className="dt1-range">{linhas.length ? `${pagina * 8 + 1}–${pagina * 8 + linhas.length} de ${r.resumo.linhas}` : 'Sem lançamentos'}</p><div className="dt1-meter"><span className="dt1-meter-fill" style={{ width: `${r?.resumo.linhas ? Math.min(100, (pagina * 8 + linhas.length) / r.resumo.linhas * 100) : 0}%` }}/></div><nav className="dt1-pager" aria-label={`Páginas de ${nome}`}><button className="dt1-page" disabled={!pagina || consulta.isFetching} onClick={() => mover(pagina - 1)} aria-label="Página anterior">‹</button><span className="dt1-page" aria-current="page">{pagina + 1}</span><button className="dt1-page" disabled={!r?.has_more || consulta.isFetching} onClick={() => mover(pagina + 1)} aria-label="Próxima página">›</button></nav></div>
    {r?.documentos_parciais && <p className="px-6 pb-3 text-xs text-warning">Consulta documental parcial; a ausência de vínculo nesta página não é conclusiva.</p>}
  </article>;
}