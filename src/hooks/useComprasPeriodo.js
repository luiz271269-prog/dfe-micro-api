import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const semData = field => ({ $or: [{ [field]: { $exists: false } }, { [field]: '' }, { [field]: null }] });
export default function useComprasPeriodo(mes, anual, pedidosPortal) {
  const client = useQueryClient();
  const periodo = anual ? mes.slice(0, 4) : mes;
  const exclusao = useMemo(() => pedidosPortal.length ? { pedido_central_id: { $nin: pedidosPortal }, pedido_central_internal_id: { $nin: pedidosPortal } } : {}, [pedidosPortal]);
  const base = useMemo(() => ({ $and: [exclusao, { $or: [{ tipo_compra: 'estoque' }, semData('tipo_compra')] }] }), [exclusao]);
  const query = useMemo(() => ({ $and: [base, { $or: [
    { data_vencimento: { $regex: `^${periodo}` } },
    { $and: [semData('data_vencimento'), { data_emissao: { $regex: `^${periodo}` } }] },
  ] }] }), [base, periodo]);
  const lista = useInfiniteQuery({
    queryKey: ['comprasPeriodo', query], initialPageParam: undefined,
    queryFn: ({ pageParam }) => base44.entities.ItemCompra.filter(query, { sort: '-data_emissao', limit: 50, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: page => page.has_more ? page.next_cursor : undefined,
  });
  const totais = useQuery({
    queryKey: ['comprasMesTotais', base],
    queryFn: () => base44.entities.ItemCompra.aggregate({
      query: { $and: [base, { status_pagamento: { $in: ['pendente', 'parcial', 'nao_identificado'] } }, semData('lancamento_cartao_id'),
        { $or: ['numero_nota', 'pedido_central_id', 'pedido'].map(field => ({ [field]: { $exists: true, $nin: ['', null] } })) }] },
      groupBy: ['data_vencimento', 'data_emissao'], sum: ['valor_total', 'valor_pago'],
    }),
  });
  useEffect(() => base44.entities.ItemCompra.subscribe(() => {
    client.invalidateQueries({ queryKey: ['comprasPeriodo'] });
    client.invalidateQueries({ queryKey: ['comprasMesTotais'] });
  }), [client]);
  const monthTotals = useMemo(() => {
    const result = {};
    for (const row of totais.data?.rows || []) {
      const month = (row.data_vencimento || row.data_emissao || '').slice(0, 7);
      if (month) result[month] = (result[month] || 0) + Math.max(0, (row.sum_valor_total || 0) - (row.sum_valor_pago || 0));
    }
    return result;
  }, [totais.data]);
  return { compras: lista.data?.pages.flatMap(page => page.items) || [], loading: lista.isPending, error: lista.error || totais.error,
    load: () => Promise.all([lista.refetch(), totais.refetch()]), monthTotals,
    hasMore: lista.hasNextPage, loadMore: lista.fetchNextPage, loadingMore: lista.isFetchingNextPage };
}