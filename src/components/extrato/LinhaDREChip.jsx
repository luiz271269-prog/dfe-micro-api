import { ROTULO_LINHA_DRE, linhaDREDe } from '@/components/extrato/linhasDRE';

export default function LinhaDREChip({ mapa, id }) {
  if (!mapa) return null;
  const linha = linhaDREDe(mapa, id);
  const regra = mapa[id]?.[1];
  const fora = linha === 'fora';
  return (
    <span title={regra ? `Regra da DRE: ${regra}` : 'Fora do período ou da regra da DRE'}
      className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${fora ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
      DRE: {ROTULO_LINHA_DRE[linha]}
    </span>
  );
}