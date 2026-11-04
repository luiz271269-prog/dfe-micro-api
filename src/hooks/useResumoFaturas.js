import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { resumirCarteiraSelecionada } from '@/functions/resumirCarteiraSelecionada';
export default function useResumoFaturas(mes, anual) {
  const client = useQueryClient();
  useEffect(() => { const atualizar = () => client.invalidateQueries({ queryKey: ['resumo-faturas'] }); window.addEventListener('neuralfinRefresh', atualizar); const unsub = base44.entities.FaturaCartao.subscribe(atualizar); return () => { window.removeEventListener('neuralfinRefresh', atualizar); unsub(); }; }, [client]);
  return useQuery({ queryKey: ['resumo-faturas', mes, anual], queryFn: async () => {
    const r = await resumirCarteiraSelecionada({ acao: 'resumo_faturas', mes, anual });
    if (r.data?.error) throw new Error(r.data.error);
    return r.data.resumo;
  } });
}