import { GripVertical } from 'lucide-react';

// Barra de abas no padrão Nexus Serviços: fundo navy, ícone dourado, texto branco
// e faixa dourada em degradê no item ativo.
export default function TabsNexus({ tabs, active, onChange }) {
  return (
    <div className="mb-6 rounded-xl overflow-hidden bg-[#0b1a33] border border-[#1e2f4d] shadow-md">
      <div className="flex flex-wrap">
        {tabs.map(([key, label, Icon]) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`relative flex items-center gap-3 text-base font-bold transition-colors whitespace-nowrap px-6 my-2 ${
              isActive ?
              'bg-gradient-to-r from-[#f2c230] via-[#e0b02a] to-[#0b1a33] text-[#0b1a33]' :
              'text-white hover:bg-white/5'}`
              }>
              
              <GripVertical className={`w-4 h-4 ${isActive ? 'text-[#0b1a33]/50' : 'text-slate-400'}`} />
              {Icon && <Icon className={`w-5 h-5 ${isActive ? 'text-[#0b1a33]' : 'text-[#f2c230]'}`} />}
              <span>{label}</span>
            </button>);

        })}
      </div>
    </div>);

}