import { useEffect, useMemo } from 'react';
import identificarCorrespondencia, { prepararCorrespondencias } from '@/components/cartoes/correspondenciasContasPagar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

async function listarTodos(entity, filtro) {
  const rows = [];
  for (let skip = 0; ; skip += 500) {
    const page = await base44.entities[entity].filter(filtro, 'id', 500, skip);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

export default function useVinculosLancamentos(lancamentos = []) {
  const client = useQueryClient();
  // Histórico compartilhado entre as tabelas; sem filtro de mês ou status de pagamento.
  const query = useQuery({
    queryKey: ['vinculos-lancamentos-cartao', 'historico'],
    enabled: lancamentos.length > 0,
    staleTime: 60000,
    queryFn: async () => {
      const [compras, despesas, obras] = await Promise.all([
        listarTodos('ItemCompra', {}),
        listarTodos('DespesaOperacional', {}),
        listarTodos('ObraReforma', {}),
      ]);
      return prepararCorrespondencias({ compras, despesas, obras });
    },
  });
  const data = useMemo(() => query.data ? {
    porLancamento: Object.fromEntries(lancamentos.map(l => [l.id, identificarCorrespondencia(l, query.data)])),
  } : undefined, [query.data, lancamentos]);
  useEffect(() => {
    const refresh = () => client.invalidateQueries({ queryKey: ['vinculos-lancamentos-cartao'] });
    const unsub = ['ItemCompra', 'DespesaOperacional', 'ObraReforma'].map(e => base44.entities[e].subscribe(refresh));
    window.addEventListener('neuralfinRefresh', refresh);
    return () => { unsub.forEach(fn => fn()); window.removeEventListener('neuralfinRefresh', refresh); };
  }, [client]);
  return { ...query, data };
}