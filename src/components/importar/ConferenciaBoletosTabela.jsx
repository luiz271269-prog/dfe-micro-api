import { useRef, useState } from 'react';
import { ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatDate, formatCurrency } from '@/lib/formatters';

const COLS = [['order','Referência'],['customer','Pagador'],['date','Liquidação'],['total','Valor liquidado'],['status','Situação']];
const estados = {confirmada:'Confirmado',pendente:'Pendente de conciliação',rejeitada:'Rejeitado'};
export default function ConferenciaBoletosTabela({ id, data, picked, setPicked, sort, dir, onSort, onPage }) {
  const wrap = useRef(), marker = useRef(), [detalhe,setDetalhe] = useState(null);
  const {rows,page,count} = data, pages = Math.ceil(count/8), all = rows.every(r => picked.has(r.id));
  const toggle = (ids, on) => setPicked(prev => { const next = new Set(prev); ids.forEach(k => on ? next.add(k) : next.delete(k)); return next; });
  const clear = () => { if (marker.current) marker.current.dataset.on = '0'; };
  function mark(e) {
    if (e.pointerType === 'touch') return;
    const m = marker.current, w = wrap.current, first = m.dataset.on !== '1';
    if (first) m.style.transition = 'none';
    m.style.height = `${e.currentTarget.offsetHeight}px`;
    m.style.translate = `0 ${e.currentTarget.getBoundingClientRect().top-w.getBoundingClientRect().top-w.clientTop}px`;
    if (first) { void m.offsetHeight; m.style.transition = ''; }
    m.dataset.on = '1';
  }
  return <><div ref={wrap} className="dt1-tablewrap" onPointerLeave={clear}><div ref={marker} className="dt1-marker" aria-hidden="true"/><table className="dt1-table">
    <thead className="dt1-thead"><tr><th scope="col" className="dt1-th dt1-th--pick"><Checkbox aria-label="Selecionar todos da página" checked={all || (rows.some(r=>picked.has(r.id)) ? 'indeterminate' : false)} onCheckedChange={on=>toggle(rows.map(r=>r.id),on===true)}/></th>
    {COLS.map(([key,label])=><th scope="col" className={`dt1-th dt1-th--${key}`} key={key} aria-sort={sort===key ? dir==='asc'?'ascending':'descending' : undefined}><button type="button" className="dt1-sort" onClick={()=>{clear();onSort(key);}}>{label}<ArrowDown className="dt1-sort-ind" aria-hidden="true"/></button></th>)}</tr></thead>
    <tbody id={`${id}-corpo`} className="dt1-tbody">{rows.map((r,i)=><tr key={r.id} className="dt1-row" data-dt1-row data-order={r.order} data-customer={r.customer} data-date={r.date} data-total={(r.total/100).toFixed(2)} data-status={r.status} data-dt1-sel={picked.has(r.id) ? '1' : '0'} style={{'--dt1-i':i}} onPointerEnter={mark}>
      <td className="dt1-cell dt1-cell--pick"><span className="dt1-rowline" aria-hidden="true"/><Checkbox aria-label={`Selecionar ${r.order}, ${r.customer}`} checked={picked.has(r.id)} onCheckedChange={on=>toggle([r.id],on===true)}/></td>
      <td className="dt1-cell dt1-cell--order"><button type="button" className="dt1-details" onClick={()=>setDetalhe(r)}>{r.order}</button></td>
      <td className="dt1-cell dt1-cell--customer"><span className="dt1-avatar" aria-hidden="true">{r.customer.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('') || 'BL'}</span><span>{r.customer || 'Não informado'}</span></td>
      <td className="dt1-cell dt1-cell--date">{formatDate(r.date)}</td><td className="dt1-cell dt1-cell--total">{formatCurrency(r.total/100)}</td>
      <td className="dt1-cell dt1-cell--status">{r.grupos.map((g,j)=><span key={g} data-status={g} className="dt1-badge">{r.status.split(' · ')[j]}</span>)}</td>
    </tr>)}</tbody></table></div>
    <footer className="dt1-foot"><div className="dt1-range" aria-live="polite">{(page-1)*8+1}–{Math.min(page*8,count)} de {count}</div><div className="dt1-meter" aria-hidden="true"><span style={{width:`${Math.min(page*8,count)/count*100}%`}}/></div><nav className="dt1-pager" aria-label="Páginas da conferência"><button className="dt1-page" aria-label="Página anterior" disabled={page===1} onClick={()=>{clear();onPage(page-1);}}><ChevronLeft size={15}/></button>{[...new Set([Math.max(1,page-1),page,Math.min(pages,page+1)])].map(n=><button key={n} className="dt1-page" aria-current={n===page?'page':undefined} onClick={()=>{clear();onPage(n);}}>{n}</button>)}<button className="dt1-page" aria-label="Próxima página" disabled={page===pages} onClick={()=>{clear();onPage(page+1);}}><ChevronRight size={15}/></button></nav></footer>
    <Dialog open={!!detalhe} onOpenChange={open=>{if(!open)setDetalhe(null);}}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{detalhe?.order} · Conferência</DialogTitle><DialogDescription>{detalhe?.customer} · {estados[detalhe?.estado]}</DialogDescription></DialogHeader>{detalhe && <><p>{formatDate(detalhe.date)} · {formatCurrency(detalhe.total/100)} no relatório</p><ul className="list-disc space-y-1 pl-5 text-sm">{(detalhe.achados.length ? detalhe.achados : ['Nenhuma divergência pelos critérios da conferência.']).map(x=><li key={x}>{x}</li>)}</ul>{!!detalhe.parcelas.length && <h4 className="text-sm font-semibold">Parcelas candidatas</h4>}{detalhe.parcelas.map(t=><p key={t.id} className="rounded-md border p-2 text-sm">{t.nota || t.referencia} · {t.referencia} · {formatDate(t.data)} · {formatCurrency(t.valor)} original · {formatCurrency(t.pago || 0)} pago</p>)}{!!detalhe.vinculadas?.length && <><h4 className="text-sm font-semibold">Outras parcelas vinculadas à mesma nota (até 30)</h4><ul className="space-y-1 text-sm">{detalhe.vinculadas.map(t=><li key={t.id} className="rounded-md border p-2">{t.referencia} · {formatDate(t.data)} · {formatCurrency(t.valor)} original · {formatCurrency(t.pago || 0)} pago</li>)}</ul></>}</>}</DialogContent></Dialog>
  </>;
}