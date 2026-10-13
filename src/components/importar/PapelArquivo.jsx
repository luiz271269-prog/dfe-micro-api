import { PAPEL_IMPORTACAO } from '@/lib/papelImportacao';
export default function PapelArquivo({tipo,compacto=false}) {
  const p=PAPEL_IMPORTACAO[tipo];
  if(!p)return null;
  return <div className={compacto?'text-[10px] text-muted-foreground':'rounded-lg border bg-card p-3 text-sm'}><strong className="text-primary">{p.papel}</strong> · {p.destino}{!compacto&&<p className="mt-1 text-xs text-muted-foreground">{p.regra}</p>}</div>;
}