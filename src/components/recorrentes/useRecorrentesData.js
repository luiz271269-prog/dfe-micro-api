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
      const [regras, lancs, cartoes, sugestoes, despesas, faturas, usuario] = await Promise.all([
        todos('RegraRecorrente', {}, 'id'),
        todos('LancamentoBancario', { data: { $gte: `${ano - 1}-01-01`, $lte: `${ano}-12-31` } }, '-data'),
        todos('LancamentoCartao', { data_lancamento: { $gte: `${ano - 1}-01-01`, $lte: `${ano}-12-31` } }, '-data_lancamento'),
        todos('SugestaoConciliacao', { entidade_tipo: 'RegraRecorrente', competencia: { $gte: `${ano - 1}-01`, $lte: `${ano}-12` } }, 'id'),
        todos('DespesaOperacional', { recorrente: true, data: { $gte: `${ano - 1}-01-01`, $lte: `${ano}-12-31` } }, 'id'),
        todos('FaturaCartao', {}, 'id'),
        base44.auth.me(),
      ]);
      return { regras, lancs, cartoes, sugestoes, despesas, faturas, usuario };
    },
  });
  useEffect(() => {
    const atualizar = () => query.refetch();
    window.addEventListener('neuralfinRefresh', atualizar);
    return () => window.removeEventListener('neuralfinRefresh', atualizar);
  }, [query.refetch]);
  return { regras: query.data?.regras || [], lancs: query.data?.lancs || [], cartoes: query.data?.cartoes || [], sugestoes: query.data?.sugestoes || [], despesas: query.data?.despesas || [], faturas: query.data?.faturas || [], usuario: query.data?.usuario, loading: query.isPending, error: query.error, load: query.refetch };
}