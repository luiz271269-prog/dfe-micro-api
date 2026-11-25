import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { consolidarDREOperacional } from '@/functions/consolidarDREOperacional';

import { operacional, aplicaDRE, campoDRE } from '@/components/dre/modeloDRE';
export const ROTULO_LINHA_DRE = {...Object.fromEntries(operacional.filter(l=>aplicaDRE(l,'caixa')).map(l=>[campoDRE(l),l.label])),fora:'Fora da DRE'};

// Mesma consulta para painel e tabela (react-query deduplica pela chave)
export function useDREExtrato(mes, isAnnual) {
  const modo = isAnnual ? 'ano_civil' : 'mensal';
  const query = useQuery({
    queryKey: ['comparativo-dre', mes, modo],
    queryFn: async () => (await consolidarDREOperacional({ mes_referencia: mes, modo_periodo: modo, incluir_mapa_extrato: true })).data,
  });
  // Reclassificar um lançamento muda a linha da DRE: recalcula junto com a lista
  const { refetch } = query;
  useEffect(() => {
    const atualizar = () => refetch();
    window.addEventListener('neuralfinRefresh', atualizar);
    return () => window.removeEventListener('neuralfinRefresh', atualizar);
  }, [refetch]);
  return query;
}

export const linhaDREDe = (mapa, id) => mapa?.[id]?.[0] || 'fora';