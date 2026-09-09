import MonthNavigator from '@/components/shared/MonthNavigator';

const OPCOES = [
  ['mensal', 'Mensal'],
  ['ano_civil', 'Ano civil'],
  ['ultimos_12', 'Últimos 12 meses'],
];

export default function PeriodoDREControls({ mes, onMesChange, modo, onModoChange }) {
  return (
    <div className="flex flex-col gap-2 w-full lg:w-auto">
      <MonthNavigator selectedMonth={mes} onSelectMonth={onMesChange} />
      <div className="grid grid-cols-3 rounded-lg bg-sidebar p-1 gap-1">
        {OPCOES.map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => onModoChange(valor)}
            className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              modo === valor
                ? 'bg-warning text-warning-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}