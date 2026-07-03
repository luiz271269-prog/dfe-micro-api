import { StatusBadgeSoft, StatusBadgeDot, StatusBadgeSolid, StatusBadgeOutline } from '@/components/shared/StatusBadgeVariants';
import PageHeader from '../components/shared/PageHeader';

const STATUSES = ['pago', 'parcial', 'a_vencer', 'vencido', 'em_aberto', 'aberta', 'paga_total'];

const VARIANTS = [
  { key: 'soft', nome: 'A · Pill suave (atual)', desc: 'Fundo leve tingido, cantos totalmente arredondados', Comp: StatusBadgeSoft },
  { key: 'dot', nome: 'B · Ponto + texto', desc: 'Minimalista, indicador de cor sem fundo', Comp: StatusBadgeDot },
  { key: 'solid', nome: 'C · Sólido', desc: 'Alto contraste, fundo saturado em maiúsculas', Comp: StatusBadgeSolid },
  { key: 'outline', nome: 'D · Contorno', desc: 'Borda colorida, fundo transparente', Comp: StatusBadgeOutline },
];

export default function ExperimentarBadges() {
  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1000px] mx-auto">
      <PageHeader title="Experimentar Badges de Status" subtitle="Compare os layouts lado a lado antes de aplicar" />

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {VARIANTS.map(({ key, nome, desc, Comp }) => (
          <div key={key} className="bg-card rounded-xl border p-5">
            <h3 className="text-sm font-bold text-foreground">{nome}</h3>
            <p className="text-xs text-muted-foreground mb-4">{desc}</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => <Comp key={s} status={s} />)}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Me diga qual variante (A, B, C ou D) você quer usar no app e eu aplico em todos os badges de status.
      </p>
    </div>
  );
}