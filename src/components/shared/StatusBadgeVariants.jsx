// Variações de layout para o badge de status — apenas visual, mesma lógica de statusConfig.
// Usadas na página /experimentar-badges para comparação lado a lado.

const statusConfig = {
  pago: { label: 'Pago', color: 'green' },
  parcial: { label: 'Parcial', color: 'yellow' },
  a_vencer: { label: 'A Vencer', color: 'blue' },
  vencido: { label: 'Vencido', color: 'red' },
  em_aberto: { label: 'Em Aberto', color: 'orange' },
  aberta: { label: 'Aberta', color: 'blue' },
  paga_total: { label: 'Paga Total', color: 'green' },
};

function resolve(status) {
  return statusConfig[status] || { label: status, color: 'slate' };
}

// ── Variante A: Pill suave (soft tint) — igual ao atual, arredondado com fundo leve ──
const softMap = {
  green: 'bg-green-500/10 text-green-700 border-green-200',
  yellow: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  blue: 'bg-blue-500/10 text-blue-700 border-blue-200',
  red: 'bg-red-500/10 text-red-700 border-red-200',
  orange: 'bg-orange-500/10 text-orange-700 border-orange-200',
  slate: 'bg-slate-500/10 text-slate-700 border-slate-200',
};

export function StatusBadgeSoft({ status }) {
  const { label, color } = resolve(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${softMap[color]}`}>
      {label}
    </span>
  );
}

// ── Variante B: Ponto + texto (dot indicator) — minimalista, sem fundo ──
const dotMap = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  slate: 'bg-slate-400',
};
const dotTextMap = {
  green: 'text-green-700',
  yellow: 'text-yellow-700',
  blue: 'text-blue-700',
  red: 'text-red-700',
  orange: 'text-orange-700',
  slate: 'text-slate-600',
};

export function StatusBadgeDot({ status }) {
  const { label, color } = resolve(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${dotTextMap[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotMap[color]}`} />
      {label}
    </span>
  );
}

// ── Variante C: Sólido (solid fill) — alto contraste, fundo saturado ──
const solidMap = {
  green: 'bg-green-600 text-white',
  yellow: 'bg-yellow-500 text-white',
  blue: 'bg-blue-600 text-white',
  red: 'bg-red-600 text-white',
  orange: 'bg-orange-500 text-white',
  slate: 'bg-slate-500 text-white',
};

export function StatusBadgeSolid({ status }) {
  const { label, color } = resolve(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide ${solidMap[color]}`}>
      {label}
    </span>
  );
}

// ── Variante D: Contorno (outline) — borda colorida, fundo transparente ──
const outlineMap = {
  green: 'border-green-500 text-green-700',
  yellow: 'border-yellow-500 text-yellow-700',
  blue: 'border-blue-500 text-blue-700',
  red: 'border-red-500 text-red-700',
  orange: 'border-orange-500 text-orange-700',
  slate: 'border-slate-400 text-slate-600',
};

export function StatusBadgeOutline({ status }) {
  const { label, color } = resolve(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border-2 bg-transparent ${outlineMap[color]}`}>
      {label}
    </span>
  );
}