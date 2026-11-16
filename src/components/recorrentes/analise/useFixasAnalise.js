import { useQuery } from '@tanstack/react-query';
import { revisarDespesasFixas } from '@/functions/revisarDespesasFixas';

export default function useFixasAnalise(mes, ativo) {
  return useQuery({
    queryKey: ['fixas-analise', mes],
    enabled: ativo,
    staleTime: 60000,
    queryFn: async () => {
      const { data } = await revisarDespesasFixas({ acao: 'analise', mes });
      if (!data?.success) throw new Error(data?.error || 'Não foi possível calcular a análise.');
      return data;
    },
  });
}