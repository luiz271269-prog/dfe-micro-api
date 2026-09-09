import PageHeader from '../components/shared/PageHeader';
import ContasAPagarPanel from '../components/contas-pagar/ContasAPagarPanel';
import SugestoesConciliacaoBanner from '../components/contas-pagar/SugestoesConciliacaoBanner';

export default function ContasAPagar() {
  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Contas a Pagar" subtitle="Despesas fixas, despesas variáveis e compras para estoque/revenda" />
      <SugestoesConciliacaoBanner />
      <ContasAPagarPanel />
    </div>
  );
}