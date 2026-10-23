export default function ContratoImportacaoIntro() {
  return <section className="mb-5 rounded-xl border bg-card p-4">
    <h2 className="font-semibold">Importar não é dar baixa</h2>
    <p className="mt-1 text-sm text-muted-foreground">Cada arquivo tem um papel de origem e uma conciliação própria. Conferir documentos, obrigações ou composição não confirma pagamento.</p>
    <ol className="mt-3 flex flex-wrap gap-2 text-xs text-primary"><li>1. Importar e conferir</li><li>→ 2. Pesquisar correspondência</li><li>→ 3. Autorizar</li><li>→ 4. Revalidar e executar</li></ol>
    <p className="mt-2 text-xs text-muted-foreground">Mesmo uma correspondência exata aguarda confirmação. O histórico existente permanece preservado.</p>
  </section>;
}