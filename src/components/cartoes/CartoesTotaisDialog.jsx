import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resumirCarteiraSelecionada } from '@/functions/resumirCarteiraSelecionada';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import CartoesTotaisTabela from '@/components/cartoes/CartoesTotaisTabela';
import '@/components/cartoes/cartoesTotais.css';

const FILTROS = [['todas', 'Todas'], ['pagas', 'Com pagamento'], ['abertas', 'A pagar'], ['parciais', 'Parciais'], ['revisao', 'Em revisão']];
export default function CartoesTotaisDialog({ modo, mes, anual, fechar }) {
  const [filtro, setFiltro] = useState(modo === 'pago' ? 'pagas' : modo === 'aberto' ? 'abertas' : 'todas'), [offset, setOffset] = useState(0);
  const consulta = useQuery({ queryKey: ['cartoes-totais-detalhe', mes, anual, modo, filtro, offset], queryFn: async () => {
    const { data } = await resumirCarteiraSelecionada({ acao: 'resumo_faturas', mes, anual, detalhar: true, somente_ativos: modo === 'ativos', filtro_faturas: filtro, offset });
    if (data.error) throw new Error(data.error); return data;
  } });
  const r = consulta.data;
  return <Dialog open onOpenChange={aberto => !aberto && fechar()}><DialogContent className="max-w-7xl w-[96vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
    <DialogHeader><DialogTitle>Lançamentos por cartão · {anual ? mes.slice(0, 4) : mes}{modo === 'ativos' ? ' · Cartões ativos' : ''}</DialogTitle><DialogDescription>Vínculos documentais e classificação do Contas a Pagar lado a lado. Os filtros consideram a situação da fatura, não o pagamento individual de cada compra.</DialogDescription></DialogHeader>
    <section className="dt1-section" data-dt1 data-dt1-enter>
      <div className="dt1-chips" role="group" aria-label="Situação das faturas">{FILTROS.map(([chave, texto], i) => <button key={chave} className="dt1-fcard" data-dt1-filter={chave} aria-pressed={filtro === chave} style={{ '--dt1-i': i }} onClick={() => { setFiltro(chave); setOffset(0); }}><span className="dt1-fcard-dot" aria-hidden="true"/><span className="dt1-fcard-name">{texto}</span><span className="dt1-fcard-n">{r?.filtros[chave] ?? '…'}</span></button>)}</div>
      <p className="py-3 text-xs text-muted-foreground">“Com pagamento” inclui faturas parciais; “A pagar” inclui qualquer saldo restante. Lançamentos, estornos e pagamentos informativos mantêm os valores originais e não precisam somar o total pago.</p>
      {consulta.isPending && <p role="status" className="dt1-empty">Consultando faturas do período...</p>}
      {consulta.isError && <div role="alert" className="dt1-empty"><p>{consulta.error.message}</p><button className="dt1-btn" onClick={() => consulta.refetch()}>Tentar novamente</button></div>}
      {r && <div className="space-y-5">{r.faturas.map(f => <CartoesTotaisTabela key={f.id} fatura={f} nome={r.cartoes.find(c => c.id === f.conta_cartao_id)?.nome || 'Cartão não localizado'}/>)}{!r.faturas.length && <p role="status" className="dt1-empty">Nenhuma fatura nesta situação no período selecionado.</p>}{r.sem_fatura.map(c => <p className="rounded-xl border p-4 text-sm" key={c.id}>{c.nome} · Sem fatura no período.</p>)}<div className="flex items-center justify-between text-xs"><span>{r.quantidade_filtrada} fatura(s) no filtro</span><div className="flex gap-2"><button className="dt1-btn" disabled={!offset} onClick={() => setOffset(offset - 10)}>Anteriores</button><button className="dt1-btn" disabled={!r.has_more} onClick={() => setOffset(offset + 10)}>Próximas</button></div></div></div>}
    </section>
  </DialogContent></Dialog>;
}