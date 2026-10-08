import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { revisarDespesasFixas } from '@/functions/revisarDespesasFixas';
export default function useFixasPainel(mes,inicio,fim) {
  const query=useInfiniteQuery({queryKey:['fixas-painel',mes,inicio,fim],initialPageParam:null,queryFn:async({pageParam})=>{const {data}=await revisarDespesasFixas({acao:'painel',mes,inicio,fim,cursor:pageParam});if(!data?.success)throw new Error(data?.error||'Não foi possível carregar as despesas fixas.');return data;},getNextPageParam:page=>page.next_cursor||undefined,staleTime:30000});
  const usuario=useQuery({queryKey:['usuario-atual'],queryFn:()=>base44.auth.me(),staleTime:300000});
  const primeira=query.data?.pages[0];
  return {...query,usuario:usuario.data,regras:query.data?.pages.flatMap(p=>p.items)||[],grupos:primeira?.grupos||[],total:primeira?.total||0,pendentes:primeira?.pendentes||0,totais:primeira?.totais||{},load:query.refetch};
}