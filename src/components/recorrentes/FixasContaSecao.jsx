import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import FixaPlanoLinha from '@/components/recorrentes/FixaPlanoLinha';
import { formatCurrency } from '@/lib/formatters';

export default function FixasContaSecao({ grupo, regras, linhaProps }) {
  const [aberto, setAberto] = useState(false);
  const previsto = regras.filter(r => r.is_ativa !== false).reduce((s, r) => s + Number(r.valor_esperado || 0), 0);
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <button type="button" onClick={() => setAberto(!aberto)} className="w-full flex items-center gap-3 bg-muted/40 px-4 py-3 text-left hover:bg-muted/60">
        {aberto ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{grupo.rotulo}</h3>
          <p className="text-xs text-muted-foreground">{grupo.count} cadastro(s) nesta conta</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Previsto por ocorrência</p>
          <p className="font-semibold tabular-nums">{formatCurrency(previsto)}</p>
        </div>
      </button>
      {aberto && <div className="divide-y border-t">{regras.map(r => <FixaPlanoLinha key={r.id} regra={r} {...linhaProps} />)}</div>}
    </section>
  );
}