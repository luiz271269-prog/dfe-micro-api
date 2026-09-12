import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const CABECALHOS = {
  green: 'bg-gradient-to-r from-emerald-600 to-teal-600',
  blue: 'bg-gradient-to-r from-blue-600 to-indigo-600',
};

export function DemoCard({ icon: Icon, titulo, subtitulo, badge, tom = 'green', children }) {
  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col">
      <div className={`${CABECALHOS[tom]} text-white px-4 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">{Icon && <Icon className="w-4 h-4" />}<h2 className="text-sm font-bold">{titulo}</h2>{subtitulo && <span className="text-xs opacity-80">{subtitulo}</span>}</div>
        {badge && <span className="text-[11px] font-semibold bg-white/20 rounded-full px-2 py-0.5">{badge}</span>}
      </div>
      <div className="p-3 space-y-0.5">{children}</div>
    </div>
  );
}

const ESTILOS = {
  grupo: { row: 'font-bold text-sm border-b', val: '' },
  item: { row: 'text-sm text-muted-foreground pl-4', val: 'text-foreground' },
  subtotal: { row: 'font-bold text-sm rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 mt-1', val: '' },
  total: { row: 'font-bold text-base rounded-lg mt-1', val: '' },
};
const TONS_TEXTO = { green: 'text-emerald-700', red: 'text-rose-700', blue: 'text-blue-700', default: '' };

// Linha de demonstrativo: valor negativo em vermelho; chevron quando há registros para auditar.
export function LinhaDemo({ rotulo, valor, nivel = 'item', tom = 'default', linha, onDrill, sub }) {
  const e = ESTILOS[nivel];
  const clicavel = linha && onDrill && linha.registros > 0;
  const cor = nivel === 'item' ? (valor < 0 ? 'text-rose-600' : 'text-foreground') : TONS_TEXTO[tom];
  const fundoTotal = nivel === 'total' ? (tom === 'green' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-blue-50 dark:bg-blue-950/30') : '';
  return (
    <div onClick={clicavel ? () => onDrill(linha) : undefined}
      className={`flex items-center justify-between gap-2 px-2 py-1.5 ${e.row} ${fundoTotal} ${clicavel ? 'cursor-pointer hover:bg-muted/50 rounded-md' : ''}`}>
      <span className={`truncate ${nivel !== 'item' ? TONS_TEXTO[tom] : ''}`}>{rotulo}{sub && <span className="block text-[11px] font-normal text-muted-foreground">{sub}</span>}</span>
      <span className={`flex items-center gap-1 tabular-nums shrink-0 ${cor}`}>
        {formatCurrency(valor)}{clicavel && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </span>
    </div>
  );
}