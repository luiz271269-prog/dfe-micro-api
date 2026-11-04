import { useInfiniteQuery } from '@tanstack/react-query';
import { consultarElegibilidadeCompras } from '@/functions/consultarElegibilidadeCompras';

export default function useElegibilidadeCompras(filtros, versao) {
  const query = useInfiniteQuery({
    queryKey: ['elegibilidade-compras', filtros, versao],
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const r = await consultarElegibilidadeCompras({ ...filtros, cursor: pageParam });
      if (r.data?.error) throw new Error(r.data.error);
      return r.data;
    },
    getNextPageParam: page => page.has_more ? page.next_cursor : undefined,
    staleTime: 30000,
  });
  return { ...query, resumo: query.data?.pages[0]?.resumo, total: query.data?.pages[0]?.total, items: query.data?.pages.flatMap(p => p.items) || [] };
}