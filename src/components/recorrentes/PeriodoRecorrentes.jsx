import { addMonths, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';

export default function PeriodoRecorrentes({ mes, modo, onMes, onModo, totais }) {
  const ano = Number(mes.slice(0, 4));
  const meses = Array.from({ length: 12 }, (_, i) => modo === '12meses'
    ? format(addMonths(new Date(`${mes}-01T12:00:00`), i - 11), 'yyyy-MM')
    : `${ano}-${String(i + 1).padStart(2, '0')}`);
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mudarAno = (delta) => onMes(`${ano + delta}-${mes.slice(5)}`);
  return <div className="my-4 space-y-2">
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="icon" onClick={() => mudarAno(-1)} aria-label="Ano anterior"><ChevronLeft /></Button>
      <span className="text-sm font-semibold">{ano}</span>
      <Button variant="outline" size="icon" onClick={() => mudarAno(1)} aria-label="Próximo ano"><ChevronRight /></Button>
      <Button size="sm" variant={modo === 'ano' ? 'default' : 'outline'} onClick={() => onModo(modo === 'ano' ? 'mes' : 'ano')}>Anual</Button>
      <Button size="sm" variant={modo === '12meses' ? 'default' : 'outline'} onClick={() => onModo('12meses')}>Últimos 12 meses</Button>
      <span className="text-xs text-muted-foreground">{modo === '12meses' ? `Até ${mes.slice(5)}/${ano}, inclusive` : 'Valores identificados nas regras, sem somar o mesmo débito duas vezes'}</span>
    </div>
    <div className="flex gap-1 overflow-x-auto pb-1">
      {meses.map(m => <button key={m} onClick={() => { onMes(m); onModo('mes'); }} className={`min-w-[72px] flex-1 rounded-lg px-2 py-1.5 text-xs border ${modo === 'mes' && mes === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
        <span className="block font-semibold">{nomes[Number(m.slice(5)) - 1]}/{m.slice(2, 4)}</span>
        <span className="block tabular-nums mt-1">{formatCurrency(totais[m] || 0, true)}</span>
      </button>)}
    </div>
  </div>;
}