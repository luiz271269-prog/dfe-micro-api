import { useId, useState } from 'react';
import { Grid2X2 } from 'lucide-react';

export default function AuditoriaRecebiveisGrupo({ nome, indice, total, indisponivel, children }) {
  const id = useId();
  const [aberto, setAberto] = useState(indice === 0);
  const tom = total == null ? 'bg-warning/25 hover:shadow-[inset_0_-3px_hsl(var(--warning))]' : total ? 'bg-destructive/15 hover:shadow-[inset_0_-3px_hsl(var(--destructive))]' : 'bg-success/15 hover:shadow-[inset_0_-3px_hsl(var(--success))]';
  const entrada = ['motion-safe:[animation-delay:350ms]', 'motion-safe:[animation-delay:430ms]', 'motion-safe:[animation-delay:510ms]', 'motion-safe:[animation-delay:590ms]'][indice];
  return <div className={`motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:[animation-fill-mode:both] ${entrada}`}>
    <h3><button id={`${id}-botao`} type="button" aria-controls={id} aria-expanded={aberto} onClick={() => setAberto(v => !v)} className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${tom}`} style={{ backgroundColor: 'transparent' }}>
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium"><Grid2X2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />{nome}</span>
      <span className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${tom.split(' ')[0]}`}>{indisponivel ? 'Indisponível' : total == null ? 'Aguardando' : total ? `${total} em revisão` : 'Sem alertas'}</span>
    </button></h3>
    <div id={id} role="region" aria-labelledby={`${id}-botao`} className={`grid bg-muted/50 transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none ${aberto ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'}`}>
      <div className="min-h-0 overflow-hidden">{aberto && children ? children : <p className="p-3 text-xs text-muted-foreground">{indisponivel ? 'Tente novamente ao reabrir a página.' : total == null ? 'Os resultados aparecem após a primeira execução.' : 'Nenhuma divergência deste tipo na última execução.'}</p>}</div>
    </div>
  </div>;
}