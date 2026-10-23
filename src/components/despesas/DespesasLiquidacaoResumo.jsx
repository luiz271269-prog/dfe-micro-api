import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { GradientCard } from '@/components/shared/GradientCard';
import { formatCurrency } from '@/lib/formatters';
export default function DespesasLiquidacaoResumo({ periodo }) {
  const client = useQueryClient();
  useEffect(() => { const atualizar = () => client.invalidateQueries({ queryKey: ['despesas-liquidacao'] }); const unsub = base44.entities.DespesaOperacional.subscribe(atualizar); window.addEventListener('neuralfinRefresh', atualizar); return () => { unsub(); window.removeEventListener('neuralfinRefresh', atualizar); }; }, [client]);
  const q = useQuery({ queryKey: ['despesas-liquidacao', periodo], queryFn: async () => {
    const base = { $and: [...(periodo ? [{ data: { $regex: `^${periodo}` } }] : []), { $or: [{ tipo_compra: 'despesas' }, { tipo_compra: { $exists: false } }, { tipo_compra: null }, { tipo_compra: '' }] }] };
    const semCartao = { $or: [{ lancamento_cartao_id: { $exists: false } }, { lancamento_cartao_id: null }, { lancamento_cartao_id: '' }] };
    const [pagas, pendentes, composicao] = await Promise.all([
      base44.entities.DespesaOperacional.aggregate({ query: { $and: [base, semCartao, { status: 'pago' }] }, sum: ['valor'] }),
      base44.entities.DespesaOperacional.aggregate({ query: { $and: [base, semCartao, { status: { $ne: 'pago' } }] }, sum: ['valor', 'valor_pago'] }),
      base44.entities.DespesaOperacional.aggregate({ query: { $and: [base, { lancamento_cartao_id: { $exists: true, $nin: [null, ''] } }] }, sum: ['valor'] }),
    ]);
    return { pago: Number(pagas.rows[0]?.sum_valor || 0), pendente: Math.max(0, Number(pendentes.rows[0]?.sum_valor || 0) - Number(pendentes.rows[0]?.sum_valor_pago || 0)), cartao: Number(composicao.rows[0]?.sum_valor || 0) };
  } });
  const valor = campo => q.data ? formatCurrency(q.data[campo]) : q.isError ? 'Indisponível' : 'Consultando...';
  return <><GradientCard title="Quitadas fora do cartão" value={valor('pago')} sub="Situação registrada; confira a evidência" icon={CheckCircle} gradient="green"/><div><GradientCard title="Saldo fora do cartão" value={valor('pendente')} sub="Componentes de faturas não são somados" icon={AlertTriangle} gradient="orange"/><p className="text-xs text-muted-foreground mt-1">Composição no cartão: {valor('cartao')}. Obrigação e pagamentos na fatura.</p>{q.isError && <button className="text-xs text-destructive underline" onClick={() => q.refetch()}>Tentar consultar novamente</button>}</div></>;
}