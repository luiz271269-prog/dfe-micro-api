import { CreditCard, Landmark, Wallet } from 'lucide-react';
import { GradientCard } from '@/components/shared/GradientCard';
import ProLaboreListaOrigem from '@/components/prolabore/ProLaboreListaOrigem';
import { formatCurrency } from '@/lib/formatters';

export default function DespesasPorOrigem({ extrato, cartoes }) {
  const totalExtrato = extrato.reduce((s, item) => s + item.valor, 0);
  const totalCartoes = cartoes.reduce((s, item) => s + item.valor, 0);

  return (
    <section className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <GradientCard title="Despesas Unificadas" value={formatCurrency(totalExtrato + totalCartoes)} sub="Total das 2 fontes" icon={Wallet} gradient="purple" />
        <GradientCard title="Despesas no Extrato" value={formatCurrency(totalExtrato)} sub={`${extrato.length} lançamento(s)`} icon={Landmark} gradient="blue" />
        <GradientCard title="Despesas nos Cartões" value={formatCurrency(totalCartoes)} sub={`${cartoes.length} lançamento(s)`} icon={CreditCard} gradient="orange" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProLaboreListaOrigem titulo="Despesas nos Cartões" icon={CreditCard} cor="orange" total={totalCartoes} itens={cartoes} />
        <ProLaboreListaOrigem titulo="Despesas no Extrato" icon={Landmark} cor="blue" total={totalExtrato} itens={extrato} />
      </div>
    </section>
  );
}