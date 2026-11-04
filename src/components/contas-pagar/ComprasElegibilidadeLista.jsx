import { formatCurrency, formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import BaixaAcaoRegistro from '@/components/baixas/BaixaAcaoRegistro';

export default function ComprasElegibilidadeLista({ consulta, onSaved }) {
  if (consulta.isPending) return <p role="status" className="py-4 text-sm text-muted-foreground">Conferindo os critérios das compras...</p>;
  if (consulta.isError) return <div role="alert" className="py-3 text-sm text-destructive">Não foi possível conferir as compras: {consulta.error.message} <Button variant="outline" size="sm" onClick={() => consulta.refetch()}>Tentar novamente</Button></div>;
  return <div className="max-h-96 space-y-2 overflow-y-auto">
    {!consulta.items.length && <p className="py-3 text-sm text-muted-foreground">Nenhum item nesta categoria e neste recorte. Isso não comprova saldo zero nem quitação.</p>}
    {consulta.items.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      <div className="min-w-0 flex-1"><p className="font-medium break-words">{r.fornecedor || 'Fornecedor não informado'} · {r.numero_nota ? `NF ${r.numero_nota}` : r.pedido || 'Sem identificação fiscal'}</p>
        <p className="text-xs text-muted-foreground break-words">{r.descricao}</p>
        <p className="text-xs text-muted-foreground">{r.empresa || 'Empresa não informada'} · Emissão: {r.data_emissao ? formatDate(r.data_emissao) : 'não informada'} · Vencimento: {r.data_vencimento ? formatDate(r.data_vencimento) : 'não informado'}</p>
        <p className="text-xs">Cadastro: {r.status_pagamento?.replaceAll('_', ' ') || 'sem estado'} · Valor cadastrado: {formatCurrency(r.valor_total || 0)}</p>
        {!!r.motivos.length && <p className="mt-1 text-xs text-warning">{r.motivos.join(' · ')}</p>}
      </div>
      <BaixaAcaoRegistro entidade="ItemCompra" registroId={r.id} descricao={r.descricao} abaInicial="editar" onSaved={onSaved}>Conferir cadastro</BaixaAcaoRegistro>
    </div>)}
    {consulta.hasNextPage && <Button size="sm" variant="outline" disabled={consulta.isFetchingNextPage} onClick={() => consulta.fetchNextPage()}>{consulta.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}</Button>}
  </div>;
}