import { useEffect } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
export default function useEvidenciasFinanceiras(direcao, estado) {
  const client = useQueryClient();
  const lista = useInfiniteQuery({ queryKey:['evidencias-financeiras',direcao,estado], initialPageParam:undefined, queryFn:({pageParam}) => base44.entities.EvidenciaFinanceira.filter({direcao,...(estado ? {estado} : {})},{sort:'-created_date',limit:50,...(pageParam ? {cursor:pageParam} : {})}), getNextPageParam:p => p.has_more ? p.next_cursor : undefined });
  const totais = useQuery({queryKey:['evidencias-totais',direcao],queryFn:() => base44.entities.EvidenciaFinanceira.aggregate({query:{direcao},groupBy:'estado',sum:'valor'})});
  const atualizar = () => {client.invalidateQueries({queryKey:['evidencias-financeiras']});client.invalidateQueries({queryKey:['evidencias-totais']});window.dispatchEvent(new Event('neuralfinRefresh'));};
  useEffect(() => base44.entities.EvidenciaFinanceira.subscribe(() => {client.invalidateQueries({queryKey:['evidencias-financeiras']});client.invalidateQueries({queryKey:['evidencias-totais']});}),[client]);
  return { lista, totais, atualizar, itens:lista.data?.pages.flatMap(p=>p.items) || [] };
}