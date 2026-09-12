import { ChevronLeft, ChevronRight, Calendar, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ALL_MONTHS } from '@/components/shared/MonthNavigator';
import DedupButton from '@/components/shared/DedupButton';
import SyncCalendarButton from '@/components/shared/SyncCalendarButton';

const NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const fmtMesLong = (m) => `${NOMES[parseInt(m.slice(5)) - 1]}/${m.slice(0, 4)}`;
const EMPRESAS = { grupo: 'Grupo NeuralTec + Liesch (consolidado)', NeuralTec: 'NeuralTec Distribuição e Tecnologia Ltda', Liesch: 'Liesch' };

export default function PainelHeader({ mes, onMes, perimetro, onPerimetro, onRefresh, refreshing }) {
  const idx = ALL_MONTHS.indexOf(mes);
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Painel Financeiro</h1>
        <p className="text-sm text-muted-foreground">{EMPRESAS[perimetro]}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-lg border bg-card shadow-sm">
          <button onClick={() => idx > 0 && onMes(ALL_MONTHS[idx - 1])} disabled={idx <= 0} className="px-2 h-9 hover:bg-muted disabled:opacity-30 rounded-l-lg"><ChevronLeft className="w-4 h-4" /></button>
          <Select value={mes} onValueChange={onMes}>
            <SelectTrigger className="h-9 border-0 shadow-none w-[170px] font-semibold gap-2 rounded-none"><Calendar className="w-4 h-4 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>{[...ALL_MONTHS].reverse().map((m) => <SelectItem key={m} value={m}>{fmtMesLong(m)}</SelectItem>)}</SelectContent>
          </Select>
          <button onClick={() => idx < ALL_MONTHS.length - 1 && onMes(ALL_MONTHS[idx + 1])} disabled={idx >= ALL_MONTHS.length - 1} className="px-2 h-9 hover:bg-muted disabled:opacity-30 rounded-r-lg"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <Select value={perimetro} onValueChange={onPerimetro}>
          <SelectTrigger className="h-9 w-[150px] bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="grupo">Grupo (todas)</SelectItem>
            <SelectItem value="NeuralTec">NeuralTec</SelectItem>
            <SelectItem value="Liesch">Liesch</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
        <DedupButton autoOncePerDay />
        <SyncCalendarButton />
      </div>
    </div>
  );
}