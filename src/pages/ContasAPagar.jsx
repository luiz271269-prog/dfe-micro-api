import { useState } from 'react';
import { Wallet, Landmark, Users, CreditCard, Receipt } from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import ContasAPagarPanel from '../components/contas-pagar/ContasAPagarPanel';
import Tributos from './Tributos';
import Despesas from './Despesas';
import Funcionarios from './Funcionarios';
import Cartoes from './Cartoes';

const TABS = [
  { key: 'consolidado', label: 'Consolidado', icon: Wallet },
  { key: 'tributos',    label: 'Tributos',    icon: Landmark },
  { key: 'despesas',    label: 'Despesas',    icon: Receipt },
  { key: 'folha',       label: 'Folha',       icon: Users },
  { key: 'cartoes',     label: 'Cartões',     icon: CreditCard },
];

export default function ContasAPagar() {
  const [tab, setTab] = useState('consolidado');

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Contas a Pagar" subtitle="Visão consolidada: despesas, tributos, folha e faturas de cartão" />

      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'consolidado' && <ContasAPagarPanel />}
      {tab === 'tributos'    && <div className="-mx-4 lg:-mx-8 -mt-2"><Tributos /></div>}
      {tab === 'despesas'    && <div className="-mx-4 lg:-mx-8 -mt-2"><Despesas /></div>}
      {tab === 'folha'       && <div className="-mx-4 lg:-mx-8 -mt-2"><Funcionarios /></div>}
      {tab === 'cartoes'     && <div className="-mx-4 lg:-mx-8 -mt-2"><Cartoes /></div>}
    </div>
  );
}