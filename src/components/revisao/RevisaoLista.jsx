import { SITUACOES, ESTADOS, PRIORIDADES } from './revisaoRotulos';
import { formatCurrency } from '@/lib/formatters';

export default function RevisaoLista({ itens, selecionado, onSelect }) {
  if (!itens.length) return <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">Nenhum item neste filtro.</div>;
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {itens.map(item => {
        const s = SITUACOES[item.situacao];
        const ativo = selecionado === item.chave;
        return (
          <li key={item.chave}>
            <button type="button" onClick={() => onSelect(item.chave)}
              className={`w-full px-4 py-3 text-left transition-colors ${ativo ? 'bg-primary/5' : 'hover:bg-muted/50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.classe}`}>{s.rotulo}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.modulo} · prioridade {PRIORIDADES[item.prioridade]}</span>
                  </div>
                  <p className="truncate text-sm font-medium">{item.titulo}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.registro.descricao}</p>
                </div>
                <div className="shrink-0 text-right">
                  {item.registro.valor != null && <p className="text-sm font-semibold tabular-nums">{formatCurrency(item.registro.valor)}</p>}
                  <p className="text-[10px] text-muted-foreground">{ESTADOS[item.estado]}</p>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}