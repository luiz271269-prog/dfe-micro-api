const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function CoberturaPeriodo({ lancsPeriodo, idsComVinculo, onVerNaoCobertos }) {
  const naoCobertos = lancsPeriodo.filter((l) => !idsComVinculo.has(l.id));
  const totalGeral = lancsPeriodo.reduce((s, l) => s + Math.abs(l.valor || 0), 0);
  const totalFora = naoCobertos.reduce((s, l) => s + Math.abs(l.valor || 0), 0);
  const pct = totalGeral ? Math.round(((totalGeral - totalFora) / totalGeral) * 100) : 100;

  return (
    <div className="rounded-lg border bg-card p-3 flex items-center gap-4 flex-wrap">
      <div className="min-w-[110px]">
        <p className="text-[11px] text-muted-foreground">Cobertura</p>
        <p className="text-xl font-bold tabular-nums">{pct}%</p>
      </div>
      <div className="flex-1 min-w-[140px]">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {lancsPeriodo.length - naoCobertos.length} de {lancsPeriodo.length} lançamentos do extrato já classificados via vínculo
        </p>
      </div>
      <button
        onClick={() => onVerNaoCobertos(naoCobertos)}
        disabled={!naoCobertos.length}
        className="text-xs font-semibold px-3 py-2 rounded-lg border hover:bg-muted disabled:opacity-40"
      >
        {naoCobertos.length} fora da matriz · {fmt(totalFora)}
      </button>
    </div>
  );
}