import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const OPCOES = [
  { valor: 'fixa', rotulo: 'Fixa', ativo: 'bg-emerald-500 text-white' },
  { valor: 'eventual', rotulo: 'Eventual', ativo: 'bg-yellow-500 text-white' },
];

export default function FixaTipoFlag({ regra, admin, onSaved }) {
  const [local, setLocal] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const atual = local || (regra.tipo_recorrencia === 'eventual' ? 'eventual' : 'fixa');

  async function definir(valor) {
    if (valor === atual) return;
    setSalvando(true);
    try {
      await base44.entities.RegraRecorrente.update(regra.id, { tipo_recorrencia: valor });
      setLocal(valor);
    } finally { setSalvando(false); }
    onSaved?.();
  }

  if (!admin) return <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">{atual === 'eventual' ? 'Eventual' : 'Fixa'}</span>;
  return (
    <div role="group" aria-label={`Fixa ou eventual: ${regra.nome}`} className="inline-flex h-8 items-center rounded-md border bg-background p-0.5 text-xs">
      {OPCOES.map(o => (
        <button key={o.valor} type="button" disabled={salvando} aria-pressed={atual === o.valor} onClick={() => definir(o.valor)}
          className={`h-full rounded px-2 font-medium transition-colors disabled:opacity-50 ${atual === o.valor ? o.ativo : 'text-muted-foreground hover:bg-muted'}`}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}