import { getOpcoes, loadCustom } from '@/lib/classificacaoUnificada';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function ResumoExecutivo({ serie, porTipo, meses }) {
  const total = serie.reduce((s, m) => s + m.total, 0);
  const media = total / (meses.length || 1);
  const ultimo = serie[serie.length - 1];
  const maior = porTipo[0];
  const opcoes = getOpcoes('tipo', loadCustom());

  const cards = [
    { label: `Total ${meses.length} meses`, valor: fmt(total) },
    { label: 'Média mensal', valor: fmt(media) },
    { label: 'Último mês', valor: fmt(ultimo?.total) },
    {
      label: 'Maior categoria',
      valor: maior ? opcoes[maior.categoria] || maior.categoria : '—',
      sub: maior ? `${fmt(maior.total)} · ${(maior.participacao * 100).toFixed(0)}%` : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-card px-4 py-3">
          <p className="text-[11px] uppercase text-muted-foreground font-semibold">{c.label}</p>
          <p className="text-lg font-bold tabular-nums mt-0.5 truncate">{c.valor}</p>
          {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}