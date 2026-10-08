import { useQuery } from '@tanstack/react-query';
import { consultarCarteiraPagarPainel } from '@/functions/consultarCarteiraPagarPainel';

export default function useCarteiraPagar(mes, perimetro) {
  return useQuery({
    queryKey: ['carteiraPagarPainel', mes, perimetro],
    queryFn: async () => {
      const resposta = await consultarCarteiraPagarPainel({ mes, perimetro });
      if (resposta.data?.error) throw new Error(resposta.data.error);
      return resposta.data;
    },
    staleTime: 120000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}