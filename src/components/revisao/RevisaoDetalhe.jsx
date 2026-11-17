import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RevisaoProcedimentos from './RevisaoProcedimentos';
import { SITUACOES, CERTEZAS, ESTADOS } from './revisaoRotulos';

export default function RevisaoDetalhe({ item, onConfirmar, onAdiar, ocupado }) {
  const [escolha, setEscolha] = useState('');
  const [alternativa, setAlternativa] = useState('');
  useEffect(() => { setEscolha(item?.procedimentos.find(p => p.sugerido)?.id || ''); setAlternativa(''); }, [item?.chave]);
  if (!item) return <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">Selecione um item para revisar.</div>;
  const proc = item.procedimentos.find(p => p.id === escolha);
  const falta = !proc || (proc.alternativa && !alternativa);
  const fechado = item.estado === 'aplicada' || item.estado === 'registrada';
  return (
    <section className="space-y-5 rounded-2xl border bg-card p-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SITUACOES[item.situacao].classe}`}>{SITUACOES[item.situacao].rotulo}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.modulo} · {CERTEZAS[item.certeza]} · {ESTADOS[item.estado]}</span>
        </div>
        <h2 className="text-lg font-semibold leading-snug">{item.titulo}</h2>
        <p className="text-sm text-muted-foreground"><b className="text-foreground">Regra:</b> {item.regra}</p>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-muted/40 p-3 text-xs">
        {item.evidencia.map(e => <div key={e.rotulo}><dt className="text-muted-foreground">{e.rotulo}</dt><dd className="font-medium break-words">{e.valor}</dd></div>)}
      </dl>
      <Link to={item.rota} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Abrir registro no módulo <ExternalLink className="h-3 w-3" /></Link>
      {fechado ? (
        <p className="rounded-xl border bg-success/5 p-3 text-sm">Decisão: <b>{item.decisao?.procedimento_rotulo}</b>{item.decisao?.decidido_por ? ` · por ${item.decisao.decidido_por}` : ''}</p>
      ) : item.procedimentos.length ? (
        <>
          <RevisaoProcedimentos procedimentos={item.procedimentos} escolha={escolha} alternativa={alternativa} onEscolha={setEscolha} onAlternativa={setAlternativa} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" disabled={ocupado} onClick={() => onAdiar(item)}>Adiar</Button>
            <Button disabled={falta || ocupado} onClick={() => onConfirmar(item, proc, alternativa)}>Revisar efeitos</Button>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Sem evidência suficiente para sugerir um procedimento. Revise no módulo de origem.</p>
      )}
    </section>
  );
}