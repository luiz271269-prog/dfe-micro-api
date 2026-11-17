import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { consultarComposicaoFatura } from '@/functions/consultarComposicaoFatura';

export default function useVinculosLancamentos(lancamentos = []) {
  const client = useQueryClient();
  const ids = useMemo(() => [...new Set(lancamentos.map(l => l.id))].sort(), [lancamentos]);
  const query = useQuery({
    queryKey: ['vinculos-lancamentos-cartao', 'confirmados', ids],
    enabled: ids.length > 0,
    staleTime: 60000,
    queryFn: async () => {
      const porLancamento = {};
      let parcial = false;
      for (let inicio = 0; inicio < ids.length; inicio += 300) {
        const blocos = [];
        for (let i = inicio; i < Math.min(inicio + 300, ids.length); i += 100) blocos.push(ids.slice(i, i + 100));
        const respostas = await Promise.all(blocos.map(async bloco => {
          const { data } = await consultarComposicaoFatura({ acao: 'vinculos_lancamentos', lancamento_ids: bloco });
          if (data.error) throw new Error(data.error);
          return data;
        }));
        respostas.forEach(data => { Object.assign(porLancamento, data.porLancamento); parcial ||= !!data.parcial; });
      }
      return { porLancamento, parcial };
    },
  });
  useEffect(() => {
    const refresh = () => client.invalidateQueries({ queryKey: ['vinculos-lancamentos-cartao'] });
    const unsub = ['ItemCompra', 'DespesaOperacional', 'ObraReforma', 'VinculoCartao'].map(e => base44.entities[e].subscribe(refresh));
    window.addEventListener('neuralfinRefresh', refresh);
    return () => { unsub.forEach(fn => fn()); window.removeEventListener('neuralfinRefresh', refresh); };
  }, [client]);
  return query;
}