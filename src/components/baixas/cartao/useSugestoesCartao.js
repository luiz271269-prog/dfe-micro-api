import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chamarBaixas } from '@/components/baixas/baixasService';

export default function useSugestoesCartao(registro) {
  const [busca, setBusca] = useState('');
  const query = useQuery({
    queryKey: ['sugestoes-cartao', registro.id, registro.versao, busca],
    queryFn: () => chamarBaixas({ acao: 'sugestoesCartao', tipo: 'LancamentoCartao', id: registro.id, busca: busca || undefined }),
    staleTime: 30000,
    retry: false,
  });
  return { ...query, busca, buscar: setBusca };
}