import { formatCurrency } from '@/lib/formatters';

export default function ResumoTopoExtrato({ lancamentos, totaisTipo, filterTipo, filterCategoria, onTipo, onCategoria }) {
  const ultimo = [...lancamentos].filter(l => l.saldo_apos != null).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
  const entradas = lancamentos.reduce((s, l) => s + ((l.valor || 0) > 0 ? l.valor : 0), 0);
  const saidas = lancamentos.reduce((s, l) => s + ((l.valor || 0) < 0 ? l.valor : 0), 0);
  const chip = (titulo, valor, ativo, onClick) => (
    <button key={titulo} onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${ativo ? 'border-primary bg-primary/10' : 'bg-card hover:bg-muted/50'}`}>
      <span className="text-muted-foreground">{titulo}:</span>
      <span className="font-semibold tabular-nums">{formatCurrency(valor)}</span>
    </button>
  );

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
      <div className="flex items-center gap-3 rounded-md border bg-card px-2 py-1">
        <span><span className="text-muted-foreground">Saldo atual: </span><span className="font-bold tabular-nums">{ultimo ? formatCurrency(ultimo.saldo_apos) : '—'}</span></span>
        <span><span className="text-muted-foreground">Entradas: </span><span className="font-semibold tabular-nums text-green-600">{formatCurrency(entradas)}</span></span>
        <span><span className="text-muted-foreground">Saídas: </span><span className="font-semibold tabular-nums text-red-600">{formatCurrency(saidas)}</span></span>
      </div>
      {chip('6. Investimentos', totaisTipo.obras || 0, filterTipo === 'obras', () => onTipo(filterTipo === 'obras' ? 'all' : 'obras'))}
      {chip('8.02 Aplicações (fora da receita)', totaisTipo.__aplicacoes || 0, filterCategoria === 'aplicacoes', () => onCategoria(filterCategoria === 'aplicacoes' ? 'all' : 'aplicacoes'))}
      {chip('8.03 Resgates (fora da receita)', totaisTipo.__resgates || 0, filterCategoria === 'resgates', () => onCategoria(filterCategoria === 'resgates' ? 'all' : 'resgates'))}
    </div>
  );
}