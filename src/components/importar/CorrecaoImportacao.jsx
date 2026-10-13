import { useState } from 'react';
import { revisarImportacao } from '@/functions/revisarImportacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import validarLeituraImportacao from '@/lib/validarLeituraImportacao';
export default function CorrecaoImportacao({batch,tipo,entity,arquivoUri,records,onSaved,onNova}) {
  const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[erro,setErro]=useState(''),[motivo,setMotivo]=useState('');
  async function comparar(){setBusy(true);setErro('');try{const invalid=validarLeituraImportacao(tipo,records);if(invalid)throw new Error(invalid);const resultados=[];for(let i=0;i<records.length;i+=100){const r=await revisarImportacao({acao:'comparar',batch_id:batch.id,tipo,entity,fatura:records.find(x=>x.data.__type==='FaturaCartao')?.data,registros:records.slice(i,i+100).map(x=>x.data)});if(!r.data?.success)throw new Error(r.data?.error);resultados.push(...r.data.resultados);}setPreview(resultados);}catch(e){setErro(e.response?.data?.error || e.message);}finally{setBusy(false);}}
  async function aplicar(){setBusy(true);setErro('');try{const mudancas=preview.filter(x=>x.patch && !x.bloqueio);for(let i=0;i<mudancas.length;i+=100){const r=await revisarImportacao({acao:'aplicar',batch_id:batch.id,tipo,motivo,arquivo_uri:arquivoUri,mudancas:mudancas.slice(i,i+100)});if(!r.data?.success)throw new Error(r.data?.error);}onSaved();}catch(e){setErro(e.response?.data?.error || e.message);}finally{setBusy(false);}}
  const aptas=preview?.filter(x=>x.patch&&!x.bloqueio) || [];
  return <section className="my-4 rounded-xl border bg-card p-4"><h3 className="font-semibold">Revisão de {batch.file_name}</h3><p className="my-2 text-xs text-muted-foreground">Sem exclusões e sem baixa automática. Só correspondências únicas podem ser corrigidas; registros conciliados ficam protegidos.</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={comparar}>{busy?'Aguarde…':'Comparar com registros existentes'}</Button><Button variant="outline" disabled={busy} onClick={onNova}>Usar leitura como nova importação</Button></div>
    {preview&&<div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{preview.map((p,i)=><div key={i} className="rounded border p-2 text-xs"><strong>{p.entity} · {p.id || `Registro ${i+1}`}</strong><p>{p.bloqueio || p.mensagem}</p>{p.patch&&<ul>{Object.entries(p.patch).map(([k,v])=><li key={k}>{k}: {String(p.antes[k] ?? '—')} → <strong>{String(v)}</strong></li>)}</ul>}</div>)}</div>}
    {!!aptas.length&&<><Input className="mt-3" value={motivo} maxLength={1000} onChange={e=>setMotivo(e.target.value)} placeholder="Motivo da correção (mínimo 10 caracteres)" /><Button className="mt-3" disabled={busy||motivo.trim().length<10} onClick={aplicar}>Confirmar {aptas.length} correções revisadas</Button></>}
    {erro&&<p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
  </section>;
}