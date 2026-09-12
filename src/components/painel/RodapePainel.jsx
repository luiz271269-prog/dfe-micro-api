import { Info } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import { fmtMesLong } from './PainelHeader';

export default function RodapePainel({ dados, atualizadoEm }) {
  const i = dados.loopR.indicadores;
  return (
    <div className="bg-card rounded-2xl border shadow-sm px-4 py-2.5 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
      <Info className="w-3.5 h-3.5 shrink-0" />
      <span>Período {fmtMesLong(dados.mes)} · Perímetro {dados.perimetro} · Regime: Competência (Operação) e Caixa (Movimentação) · Fontes: {i.completudeFontes} carregadas · Classificação: {i.coberturaClassificacao ?? '—'}% · Atualizado: {formatDateTime(atualizadoEm)}</span>
    </div>
  );
}