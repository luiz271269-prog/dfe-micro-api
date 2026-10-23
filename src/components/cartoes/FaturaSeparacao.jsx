import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { consultarComposicaoFatura } from '@/functions/consultarComposicaoFatura';
import { Button } from '@/components/ui/button';
import FaturaComposicaoLista from '@/components/cartoes/FaturaComposicaoLista';
import FaturaPagamentoResumo from '@/components/cartoes/FaturaPagamentoResumo';
export default function FaturaSeparacao({ faturaId, versao }) {
  const [aba, setAba] = useState('composicao'), client = useQueryClient();
  const consulta = useInfiniteQuery({ queryKey: ['fatura-separacao', faturaId, versao], initialPageParam: null, queryFn: async ({ pageParam }) => {
    const { data } = await consultarComposicaoFatura({ fatura_id: faturaId, cursor: pageParam || undefined });
    if (data.error) throw new Error(data.error);
    return data;
  }, getNextPageParam: p => p.has_more ? p.next_cursor : undefined });
  useEffect(() => { const atualizar = () => client.invalidateQueries({ queryKey: ['fatura-separacao', faturaId] }); window.addEventListener('neuralfinRefresh', atualizar); return () => window.removeEventListener('neuralfinRefresh', atualizar); }, [client, faturaId]);
  return <section className="rounded-xl border bg-card p-3 space-y-3">
    <h3 className="font-semibold text-sm">Composição e pagamento são controles separados</h3>
    <div className="flex flex-wrap gap-2"><Button size="sm" variant={aba === 'composicao' ? 'default' : 'outline'} onClick={() => setAba('composicao')}>Composição da fatura</Button><Button size="sm" variant={aba === 'pagamento' ? 'default' : 'outline'} onClick={() => setAba('pagamento')}>Pagamento da fatura</Button></div>
    {consulta.isPending ? <p role="status" className="text-sm text-muted-foreground">Consultando fatura...</p> : consulta.isError ? <div role="alert" className="text-sm text-destructive"><p>{consulta.error.message}</p><Button size="sm" variant="outline" onClick={() => consulta.refetch()}>Tentar novamente</Button></div> : aba === 'composicao' ? <FaturaComposicaoLista consulta={consulta}/> : <FaturaPagamentoResumo resumo={consulta.data.pages[0].resumo}/>}
    <p className="text-xs text-muted-foreground">Consulta sem escrita. Valores, pagamentos e auditorias históricos permanecem preservados.</p>
  </section>;
}