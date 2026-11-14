import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function SaneamentoGrupo({ grupo, opcoesCategoria, selecionados, onToggle }) {
  const ids = grupo.itens.map(i => i.id);
  const todosMarcados = ids.every(id => selecionados.has(id));

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center gap-2 bg-muted/50 px-3 py-2">
        <Checkbox checked={todosMarcados} onCheckedChange={() => onToggle(ids, !todosMarcados)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{grupo.itens[0].descricao}</p>
          <p className="text-[11px] text-muted-foreground">
            {grupo.itens.length} lançamento(s) ·{' '}
            {grupo.sugestao
              ? <span className="text-emerald-700">Histórico: {opcoesCategoria[grupo.sugestao] || grupo.sugestao} ({grupo.evidencia})</span>
              : 'Sem histórico para esta descrição'}
          </p>
        </div>
      </div>
      <div className="divide-y">
        {grupo.itens.map(l => (
          <div key={l.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
            <Checkbox checked={selecionados.has(l.id)} onCheckedChange={() => onToggle([l.id], !selecionados.has(l.id))} />
            <span className="min-w-0 flex-1 truncate">
              {formatDate(l.data)} · {l.descricao}
            </span>
            <span className={`shrink-0 tabular-nums font-medium ${(l.valor || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(l.valor)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}