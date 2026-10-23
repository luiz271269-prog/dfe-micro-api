import { useQuery } from '@tanstack/react-query';
import { importacaoFinanceira } from '@/functions/importacaoFinanceira';
export default function useContratoImportacao() {
  return useQuery({queryKey:['contrato-importacao'],staleTime:Infinity,queryFn:async()=>{const r=await importacaoFinanceira({acao:'contrato'});if(r.data?.error)throw new Error(r.data.error);return r.data.matriz;}});
}