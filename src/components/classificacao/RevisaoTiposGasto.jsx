import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import TipoGastoSelector from '@/components/shared/TipoGastoSelector';
import { formatCurrency } from '@/lib/formatters';

const MODULOS = { LancamentoBancario: 'Extrato — gastos sem vínculo', LancamentoCartao: 'Cartão — lançamentos', ItemCompra: 'Compras', DespesaOperacional: 'Despesas', Tributo: 'Impostos', FolhaPagamento: 'Folha', ObraReforma: 'Obras / Reformas', RegraRecorrente: 'Recorrentes' };
export default function RevisaoTiposGasto({ onSaved }) {
  const [open, setOpen] = useState(false);
  const [entidade, setEntidade] = useState('LancamentoCartao');
  const [offset, setOffset] = useState(0);
  const qc = useQueryClient();
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['revisao-tipos-gasto', entidade, offset], enabled: open,
    queryFn: async () => { const res = await revisarTiposGasto({ action: 'listar', entidade, offset }); if (res.data?.error) throw new Error(res.data.error); return res.data; },
  });
  function atualizado() { setOffset(0); qc.invalidateQueries({ queryKey: ['revisao-tipos-gasto'] }); onSaved?.(); }
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Reclassificar gastos antigos</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Gastos pendentes de classificação</DialogTitle><DialogDescription>Escolha manualmente um dos seis tipos. O valor anterior é preservado até você confirmar a nova escolha; os vínculos da obrigação recebem o mesmo tipo.</DialogDescription></DialogHeader>
        <label className="text-sm">Módulo<select aria-label="Módulo para reclassificação" value={entidade} onChange={e => { setEntidade(e.target.value); setOffset(0); }} className="ml-2 max-w-full rounded border bg-background p-2">{Object.entries(MODULOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <p className="text-xs text-muted-foreground">Recebimentos, transferências e saques não são gastos. Débitos já conciliados devem ser revisados na obrigação de origem; faturas são classificadas pelos lançamentos do cartão.</p>
        {error ? <div role="alert" className="text-sm text-destructive">{error.response?.data?.error || error.message}<Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button></div> : isFetching ? <p className="text-sm text-muted-foreground">Carregando pendências…</p> : <div className="divide-y">
          {(data?.itens || []).map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex-1 min-w-0"><p className="text-sm font-medium break-words">{r.descricao}</p><p className="text-xs text-muted-foreground">{r.data || 'Sem data'} · Anterior: {r.tipo_compra || 'não informado'}</p></div>
            <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.valor)}</span>
            <TipoGastoSelector entityName={entidade} record={r} onChange={atualizado} />
          </div>)}
          {!data?.itens?.length && <p className="py-6 text-sm text-muted-foreground">{data?.has_more ? 'Nenhum gasto aplicável neste lote; avance para continuar.' : 'Nenhuma pendência neste lote.'}</p>}
        </div>}
        <div className="flex justify-between items-center gap-2"><Button size="sm" variant="outline" disabled={!offset || isFetching} onClick={() => setOffset(Math.max(0, offset - 50))}>Anterior</Button><span className="text-xs text-muted-foreground">Lote {offset / 50 + 1} · até 50 registros por consulta</span><Button size="sm" variant="outline" disabled={!data?.has_more || isFetching} onClick={() => setOffset(data.next_offset)}>Próximo</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}