import PageHeader from '../components/shared/PageHeader';
import ContasAPagarPanel from '../components/contas-pagar/ContasAPagarPanel';
import SugestoesConciliacaoBanner from '../components/contas-pagar/SugestoesConciliacaoBanner';

export default function ContasAPagar() {
  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Contas a Pagar" subtitle="Visão consolidada: despesas, tributos, folha e faturas de cartão" />
      <SugestoesConciliacaoBanner />
      <ContasAPagarPanel />
    </div>
  );
}