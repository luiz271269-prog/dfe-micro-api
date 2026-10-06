import { Input } from '@/components/ui/input';
import useDocumentoTrabalhista from '@/components/funcionarios/documentos/useDocumentoTrabalhista';
import AnexoTrabalhistaButton from '@/components/funcionarios/documentos/AnexoTrabalhistaButton';

export default function DocumentoTrabalhistaImportador({ tipo, value, onChange, onBusy, disabled = false }) {
  const { busy,error,importar,colar } = useDocumentoTrabalhista(tipo,onChange,onBusy);
  return <section className="rounded-lg border bg-muted/30 p-3 space-y-2" onPaste={e => { if (!disabled) colar(e); }} tabIndex={0} aria-label="Importar documento ou colar print">
    <h3 className="text-sm font-semibold">Importar {tipo === 'ferias' ? 'recibo de férias' : 'termo de rescisão'}</h3>
    <p className="text-xs text-muted-foreground">Clique nesta área e cole um print (Ctrl+V), ou anexe PDF/imagem de até 10 MB; a leitura preenche os campos para sua revisão, sem salvar nem confirmar pagamentos.</p>
    <Input aria-label="Selecionar documento trabalhista" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={disabled || busy} onChange={e => { importar(e.target.files?.[0]); e.target.value=''; }} />
    {busy && <p role="status" className="text-sm text-muted-foreground">Lendo o documento...</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error} Selecione ou cole novamente para tentar outra vez.</p>}
    {value && <>
      <div className="flex items-center gap-2 text-xs"><span className="break-all">{value.nome}</span><AnexoTrabalhistaButton uri={value.file_uri} nome={value.nome} /></div>
      <details><summary className="cursor-pointer text-xs font-semibold">Dados originais extraídos</summary><dl className="grid grid-cols-2 gap-2 mt-2 text-xs">{Object.entries(value.dados).map(([k,v]) => <div key={k}><dt className="text-muted-foreground">{k.replaceAll('_',' ')}</dt><dd className="break-words">{String(v)}</dd></div>)}</dl></details>
      {value.avisos?.map((v,i) => <p key={i} className="text-xs text-warning">{v}</p>)}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={disabled || busy} checked={!!value.revisado} onChange={e => onChange({ ...value,revisado:e.target.checked })} />Conferi o funcionário, as datas e os valores com o documento original.</label>
    </>}
  </section>;
}