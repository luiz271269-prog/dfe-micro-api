import { Link2, Search, CircleHelp } from 'lucide-react';

const estados = {
  vinculado: { texto: 'Vinculado', cor: 'text-success bg-success/10', Icone: Link2 },
  possivel: { texto: 'Possível correspondência — revisar', cor: 'text-warning bg-warning/10', Icone: Search },
  divergente: { texto: 'Vínculo divergente — revisar', cor: 'text-warning bg-warning/10', Icone: CircleHelp },
  nao_localizado: { texto: 'Não localizado na consulta', cor: 'text-muted-foreground bg-muted', Icone: CircleHelp },
};

export default function VinculoLancamentoInfo({ lancamento, consulta }) {
  if (consulta.isPending) return <span className="text-muted-foreground">Consultando correspondências…</span>;
  if (consulta.isError) return <div className="text-destructive text-[10px]">Consulta indisponível.<button type="button" className="block underline" onClick={() => consulta.refetch()}>Tentar novamente</button></div>;
  const resultado = consulta.data?.porLancamento[lancamento.id];
  if (!resultado) return <span className="text-muted-foreground">Consultando correspondências…</span>;
  const { texto, cor, Icone } = estados[resultado.status];
  return <div className="space-y-1 min-w-44 max-w-64 text-[10px]">
    <span className={`inline-flex items-start gap-1 rounded px-1.5 py-0.5 font-medium ${cor}`}><Icone className="w-3 h-3 shrink-0 mt-0.5" />{texto}</span>
    {resultado.referenciaAusente && <p className="text-muted-foreground">A referência de compra gravada não foi localizada.</p>}
    {resultado.registros.length > 0 ? <details>
      <summary className="cursor-pointer text-primary">Ver identificação e evidências ({resultado.registros.length})</summary>
      <ul className="space-y-2 mt-1">{resultado.registros.map(r => <li key={r.id} className="break-words"><p className="font-medium">{r.label}</p><p className="text-muted-foreground">{r.evidencia}</p></li>)}</ul>
    </details> : <p className="text-muted-foreground">Compras, despesas e obras consultadas, incluindo pagas; nenhum vínculo ou candidato pelos critérios atuais.</p>}
  </div>;
}