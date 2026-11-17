import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { revisarClassificacaoCartoes } from '@/functions/revisarClassificacaoCartoes';

export default function useRevisaoHistoricoCartoes(mes, anual) {
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const escopo = `${mes}|${anual}|${mostrarTodas}`;
  const atual = useRef(escopo); atual.current = escopo;
  const consulta = useInfiniteQuery({
    queryKey: ['revisao-historico-cartoes', mes, mostrarTodas],
    enabled: !anual,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await revisarClassificacaoCartoes({ meses: [mes], offset: pageParam, incluir_conferidos: mostrarTodas });
      if (data.error) throw new Error(data.error);
      return data;
    },
    getNextPageParam: pagina => pagina.revisoes[0].has_more ? pagina.revisoes[0].next_offset : undefined,
    refetchOnWindowFocus: false,
    retry: false,
  });
  useEffect(() => { setFeedback(null); }, [mes, anual, mostrarTodas]);
  const dados = consulta.data?.pages[0];
  const revisao = dados ? { ...dados.revisoes[0], itens: consulta.data.pages.flatMap(p => p.revisoes[0].itens), has_more: consulta.hasNextPage } : null;
  async function salvo(data, texto) {
    if (atual.current !== escopo) return;
    setFeedback({ error: !data.success || data.pendentes > 0, texto });
    if (data.success || data.salvos || data.conferidos || data.reabertos) {
      window.dispatchEvent(new Event('neuralfinRefresh'));
      await consulta.refetch();
    }
  }
  return {
    dados, revisao, feedback, salvo, mostrarTodas, setMostrarTodas,
    loading: !anual && (consulta.isPending || consulta.isFetching),
    error: consulta.error?.response?.data?.error || consulta.error?.message || '',
    atualizar: (mais = false) => mais ? consulta.fetchNextPage() : consulta.refetch(),
  };
}