import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
export default function useResumoFaturas(mes, anual) {
  const client = useQueryClient();
  useEffect(() => { const atualizar = () => client.invalidateQueries({ queryKey: ['resumo-faturas'] }); window.addEventListener('neuralfinRefresh', atualizar); const unsub = base44.entities.FaturaCartao.subscribe(atualizar); return () => { window.removeEventListener('neuralfinRefresh', atualizar); unsub(); }; }, [client]);
  return useQuery({ queryKey: ['resumo-faturas', mes, anual], queryFn: async () => {
    const r = await base44.entities.FaturaCartao.aggregate({ query: { mes_referencia: anual ? { $regex: `^${mes.slice(0, 4)}-` } : mes }, groupBy: ['valor_total', 'valor_pago'], limit: 1000 });
    if (r.truncated) throw new Error('Resumo de faturas excede o limite seguro.');
    const total = r.rows.reduce((s, x) => ({ total: s.total + Number(x.valor_total || 0) * x.count, pago: s.pago + Number(x.valor_pago || 0) * x.count, saldo: s.saldo + Math.max(0, Number(x.valor_total || 0) - Number(x.valor_pago || 0)) * x.count, quantidade: s.quantidade + x.count }), { total: 0, pago: 0, saldo: 0, quantidade: 0 });
    return total;
  } });
}