import useContratoImportacao from '@/hooks/useContratoImportacao';
export default function PapelArquivo({tipo,compacto=false}) {
  const {data=[]}=useContratoImportacao();const p=data.find(p=>p.tipo===tipo);
  if(!p)return null;
  return <div className={compacto?'text-[10px] text-muted-foreground':'rounded-lg border bg-card p-3 text-sm'}><strong className="text-primary">{p.grupo}</strong> · {p.conciliacao==='nenhuma'?'Conciliação posterior':p.conciliacao.replaceAll('_',' ')}{!compacto&&<><p className="mt-1 text-xs text-muted-foreground">{p.regra}</p><p className="mt-1 text-xs">Liquidação na importação: não.</p></>}</div>;
}