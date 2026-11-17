import ComponenteFaturaDocumentos from '@/components/cartoes/ComponenteFaturaDocumentos';

export default function VinculoLancamentoInfo({ lancamento, consulta }) {
  if (consulta.isPending) return <span className="text-muted-foreground">Consultando vínculos…</span>;
  if (consulta.isError) return <div className="text-destructive text-xs">Consulta indisponível.<button type="button" className="block underline" onClick={() => consulta.refetch()}>Tentar novamente</button></div>;
  const documentos = consulta.data?.porLancamento[lancamento.id] || [];
  return <div className="min-w-56 max-w-80 text-xs">
    <span className={documentos.length ? 'rounded px-2 py-1 text-success bg-success/10' : 'rounded px-2 py-1 text-muted-foreground bg-muted'}>{documentos.length ? 'Compromisso vinculado' : 'Compromisso não localizado'}</span>
    <ComponenteFaturaDocumentos documentos={documentos}/>
    {consulta.data?.parcial && <p className="mt-1 text-warning">Consulta parcial; a ausência de vínculo não é conclusiva.</p>}
  </div>;
}