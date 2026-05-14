import PageHeader from '../components/shared/PageHeader';
import ContasAPagarPanel from '../components/contas-pagar/ContasAPagarPanel';

export default function ContasAPagar() {
  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Contas a Pagar" subtitle="Visão consolidada: despesas, tributos, folha e faturas de cartão" />
      <ContasAPagarPanel />
    </div>
  );
}