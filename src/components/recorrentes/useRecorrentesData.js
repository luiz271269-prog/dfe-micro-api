import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

async function todos(entity, filtro, ordem) {
  const resultado = [];
  for (let skip = 0; ; skip += 500) {
    const pagina = await base44.entities[entity].filter(filtro, ordem, 500, skip);
    resultado.push(...pagina);
    if (pagina.length < 500) return resultado;
  }
}
export default function useRecorrentesData(mes) {
  const ano = Number(mes.slice(0, 4));
  const query = useQuery({
    queryKey: ['recorrentes-periodo', ano],
    queryFn: async () => {
      const [regras, lancs] = await Promise.all([
        todos('RegraRecorrente', {}, 'id'),
        todos('LancamentoBancario', { data: { $gte: `${ano - 1}-01-01`, $lte: `${ano}-12-31` } }, '-data'),
      ]);
      return { regras, lancs };
    },
  });
  useEffect(() => {
    const atualizar = () => query.refetch();
    window.addEventListener('neuralfinRefresh', atualizar);
    return () => window.removeEventListener('neuralfinRefresh', atualizar);
  }, [query.refetch]);
  return { regras: query.data?.regras || [], lancs: query.data?.lancs || [], loading: query.isPending, error: query.error, load: query.refetch };
}