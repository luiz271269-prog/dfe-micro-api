import { useQuery } from '@tanstack/react-query';
import { calcularFluxoConsolidado } from '@/functions/calcularFluxoConsolidado';

export function useFluxoConsolidado(mes, perimetro) {
  return useQuery({
    queryKey: ['fluxoConsolidado', mes, perimetro],
    queryFn: async () => (await calcularFluxoConsolidado({ mes, perimetro, historico: 6 })).data,
    staleTime: 5 * 60 * 1000,
  });
}

export function variacao(atual, anterior) {
  if (atual == null || anterior == null || !anterior) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
}