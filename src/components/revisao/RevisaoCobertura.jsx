// Estado de leitura por detector: deixa claro o que é parcial ou não pôde ser lido.
export default function RevisaoCobertura({ modulos }) {
  if (!modulos?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-2 text-[11px]">
      {modulos.map(m => (
        <span key={m.detector} className={`rounded-full border px-2 py-0.5 ${m.lido ? 'text-muted-foreground' : 'border-destructive/40 text-destructive'}`}
          title={m.erro || (m.parcial ? 'Leitura limitada aos registros mais recentes' : '')}>
          {m.modulo}: {m.lido ? `${m.encontrados}${m.parcial ? '+ (parcial)' : ''}` : 'não lido'}
        </span>
      ))}
    </div>
  );
}