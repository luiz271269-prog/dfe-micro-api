import { GRUPOS } from '@/lib/gruposContasPagar';

export default function GrupoContaBadge({ grupo, className = '' }) {
  const g = GRUPOS[grupo] || GRUPOS.revisar;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${g.chip} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} />
      {g.rotulo}
    </span>
  );
}