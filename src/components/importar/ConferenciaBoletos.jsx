import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Check, Table2 } from 'lucide-react';
import { gerenciarEvidenciasFinanceiras } from '@/functions/gerenciarEvidenciasFinanceiras';
import { formatCurrency } from '@/lib/formatters';
import ConferenciaBoletosTabela from '@/components/importar/ConferenciaBoletosTabela';
import './conferenciaBoletos.css';

const filtros = [['todos','Todos'],['confere','Conferem'],['diferenca','Diferenças'],['duplicidade','Duplicatas possíveis'],['sem_par','Sem parcela']];
const moeda = c => formatCurrency(c/100);
function Exportar({ children, ...props }) { return <button type="button" className="dt1-btn dt1-btn--beam" {...props}><span className="dt1-beam-track" aria-hidden="true"><span className="dt1-beam" /></span><Download size={14} />{children}</button>; }

export default function ConferenciaBoletos({ loteId }) {
  const id = useId();
  const [filtro, setFiltro] = useState('todos'), [pagina, setPagina] = useState(1), [sort, setSort] = useState('date'), [dir, setDir] = useState('desc');
  const [picked, setPicked] = useState(new Set()), [exportando, setExportando] = useState(false), [msg, setMsg] = useState(''), [enter, setEnter] = useState(true);
  const args = { acao:'conferencia_boletos', lote_id:loteId, filtro, pagina, sort, dir };
  const q = useQuery({queryKey:['conferencia-boletos', loteId, filtro, pagina, sort, dir], queryFn:async () => (await gerenciarEvidenciasFinanceiras(args)).data});
  const d = q.data, total = d?.counts.todos ?? 0, bulk = picked.size > 0;
  useEffect(() => { if (!d || !enter) return; const t = setTimeout(() => setEnter(false), 1100); return () => clearTimeout(t); }, [d, enter]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 3200); return () => clearTimeout(t); }, [msg]);
  useEffect(() => { const refresh = () => q.refetch(); window.addEventListener('neuralfinRefresh', refresh); return () => window.removeEventListener('neuralfinRefresh', refresh); }, [q.refetch]);
  async function exportar(selecionados) {
    setExportando(true); setMsg('');
    try {
      const {data} = await gerenciarEvidenciasFinanceiras({...args, exportar:true, ...(selecionados ? {ids:[...picked]} : {})});
      if (!data.quantidade) { setMsg('Nenhuma linha para exportar.'); return; }
      const url = URL.createObjectURL(new Blob(['\uFEFF',data.csv],{type:'text/csv;charset=utf-8;'}));
      const a = document.createElement('a'); a.href = url; a.download = 'conferencia-boletos.csv'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg(`CSV gerado: ${data.quantidade} registro(s).`);
    } catch { setMsg('Não foi possível exportar.'); } finally { setExportando(false); }
  }
  return <section className="dt1-section" data-dt1 data-dt1-enter={enter ? '' : undefined} aria-labelledby={`${id}-titulo`}><div className="dt1-card"><div className="dt1-shell">
    <header className="dt1-head"><div className="dt1-titles"><h3 id={`${id}-titulo`} className="dt1-title">Conferência de boletos liquidados</h3><p className="dt1-meta">{d ? `${total} boletos identificados · 8 por página` : 'Relatório × Contas a Receber'}</p></div>{!bulk && <span className="dt1-export"><Exportar disabled={!d?.count || exportando} onClick={() => exportar(false)}>Exportar CSV</Exportar></span>}</header>
    {d && <div className="dt1-summary"><strong>Relatório (boletos identificados, sem duplicar evidências): {moeda(d.total)}</strong><span>Boletos com par único: {moeda(d.comparavel)}</span><span>Parcelas correspondentes: {moeda(d.receber)}</span><span>Diferença nos pares: {moeda(d.comparavel-d.receber)}</span><span>Fora da comparação: {moeda(d.total-d.comparavel)}</span><span>{d.repetidos} linhas já registradas{d.semLeitura ? ` · ${d.semLeitura} sem origem individual disponível` : ''}</span><p>Valores originais das parcelas, não saldo em aberto. Apenas conferência, sem baixa.</p></div>}
    <div className="dt1-toolwrap"><div className="dt1-tools" style={{visibility:bulk?'hidden':undefined}}><div className="dt1-chips" role="group" aria-label="Filtrar achados">{filtros.map(([k,label],i) => <button type="button" key={k} className="dt1-fcard" data-dt1-filter={k} title={label} aria-controls={`${id}-corpo`} aria-pressed={filtro===k} style={{'--dt1-i':i}} onClick={() => {setFiltro(k);setPagina(1);}}><span className="dt1-fcard-dot" aria-hidden="true"/><span className="dt1-fcard-name">{label}</span><span className="dt1-fcard-n">{d?.counts[k] ?? '–'}</span><span className="dt1-share" aria-hidden="true" style={{'--share':`${total ? d.counts[k]/total*100 : 0}%`}} /></button>)}</div></div>
    {bulk && <div className="dt1-bulk"><span className="dt1-bulk-n">{picked.size} selecionado(s)</span><button type="button" className="dt1-btn dt1-btn--ghost" onClick={() => setPicked(new Set())}>Limpar</button><Exportar disabled={exportando} onClick={() => exportar(true)}>Exportar seleção</Exportar></div>}</div>
    {q.isPending ? <div className="dt1-tablewrap" role="status"><span className="sr-only">Conferindo boletos…</span><div className="dt1-skel" aria-hidden="true">{Array.from({length:8},(_,i)=><div key={i} className="dt1-skel-row" />)}</div></div> : q.isError ? <p className="dt1-empty" role="alert">Não foi possível carregar a conferência. <button className="dt1-btn" onClick={() => q.refetch()}>Tentar novamente</button></p> : !d.count ? <div className="dt1-empty"><Table2 size={20}/><strong>Nenhum boleto neste filtro</strong><p>{total ? 'Escolha outro filtro para consultar o lote.' : 'Não foram encontradas evidências rastreáveis neste lote.'}</p></div> : <ConferenciaBoletosTabela id={id} data={d} picked={picked} setPicked={setPicked} sort={sort} dir={dir} onSort={k => {setDir(k===sort ? (dir==='asc'?'desc':'asc') : ['total','date'].includes(k)?'desc':'asc');setSort(k);setPagina(1);}} onPage={setPagina} />}
    <div role="status" className="dt1-toast" hidden={!msg}><Check size={14} aria-hidden="true"/>{msg}</div>
  </div></div></section>;
}