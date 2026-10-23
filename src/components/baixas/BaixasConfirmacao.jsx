import { useState,useEffect } from 'react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
export default function BaixasConfirmacao({operacao,onClose,onConfirm,busy,erro}) {
  const [conferido,setConferido]=useState(false);
  useEffect(()=>setConferido(false),[operacao]);
  return <Dialog open={!!operacao} onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Conferir antes de confirmar</DialogTitle><DialogDescription>A operação modifica a origem financeira e ficará no histórico de auditoria.</DialogDescription></DialogHeader>
    <dl className="text-sm space-y-2">{Object.entries(operacao?.resumo||{}).map(([k,v])=><div key={k} className="border-b pb-2"><dt className="text-xs text-muted-foreground capitalize">{k.replaceAll('_',' ')}</dt><dd className="break-words">{String(v)}</dd></div>)}</dl>
    <p className="text-sm border rounded-lg p-3">Motivo: {operacao?.payload?.motivo}</p>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={conferido} onChange={e=>setConferido(e.target.checked)}/>Conferi os dados e autorizo esta operação individual.</label>
    {erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}
    <div className="flex gap-2 justify-end"><Button variant="outline" disabled={busy} onClick={onClose}>Voltar</Button><Button disabled={!conferido||busy} onClick={onConfirm}>{busy?'Registrando...':'Confirmar operação'}</Button></div>
  </DialogContent></Dialog>;
}