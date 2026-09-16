import { useEffect } from 'react';
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
  const ids = [...new Set(lancamentos.map(l => l.id))].sort();
  const comprasIds = [...new Set(lancamentos.map(l => l.item_compra_id).filter(Boolean))].sort();
  const faturasIds = [...new Set(lancamentos.map(l => l.fatura_id).filter(Boolean))].sort();
  const query = useQuery({
    queryKey: ['vinculos-lancamentos-cartao', ids, comprasIds, faturasIds],
    enabled: ids.length > 0,
    queryFn: async () => {
      const reverso = { lancamento_cartao_id: { $in: ids } };
      const [compras, despesas, obras, faturas] = await Promise.all([
        listarTodos('ItemCompra', comprasIds.length ? { $or: [reverso, { id: { $in: comprasIds } }] } : reverso),
        listarTodos('DespesaOperacional', reverso),
        listarTodos('ObraReforma', reverso),
        faturasIds.length ? listarTodos('FaturaCartao', { id: { $in: faturasIds } }) : [],
      ]);
      const porLancamento = {};
      for (const [tipo, registros] of [['Compra', compras], ['Despesa', despesas], ['Obra', obras]]) {
        for (const r of registros) {
          const destinos = new Set([r.lancamento_cartao_id, ...lancamentos.filter(l => tipo === 'Compra' && l.item_compra_id === r.id).map(l => l.id)].filter(Boolean));
          for (const id of destinos) (porLancamento[id] ||= []).push({ id: `${tipo}-${r.id}`, label: `${tipo}: ${r.pedido_central_id || r.numero_nota || r.descricao || r.descricao_produto || r.fornecedor || r.id}` });
        }
      }
      return { porLancamento, faturas: Object.fromEntries(faturas.map(f => [f.id, f])) };
    },
  });
  useEffect(() => {
    const refresh = () => client.invalidateQueries({ queryKey: ['vinculos-lancamentos-cartao'] });
    const unsub = ['ItemCompra', 'DespesaOperacional', 'ObraReforma', 'FaturaCartao'].map(e => base44.entities[e].subscribe(refresh));
    window.addEventListener('neuralfinRefresh', refresh);
    return () => { unsub.forEach(fn => fn()); window.removeEventListener('neuralfinRefresh', refresh); };
  }, [client]);
  return query;
}