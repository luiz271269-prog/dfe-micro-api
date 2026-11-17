import { SITUACOES, ESTADOS } from './revisaoRotulos';

function Chips({ titulo, opcoes, valor, onChange }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {[['todos', 'Todos'], ...opcoes].map(([id, rotulo]) => (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${valor === id ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RevisaoFiltros({ modulos, filtros, onChange }) {
  const set = campo => v => onChange({ ...filtros, [campo]: v });
  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-4 lg:grid-cols-3">
      <Chips titulo="Módulo" opcoes={modulos.map(m => [m, m])} valor={filtros.modulo} onChange={set('modulo')} />
      <Chips titulo="Situação" opcoes={Object.entries(SITUACOES).map(([k, v]) => [k, v.rotulo])} valor={filtros.situacao} onChange={set('situacao')} />
      <Chips titulo="Decisão" opcoes={Object.entries(ESTADOS)} valor={filtros.estado} onChange={set('estado')} />
    </div>
  );
}