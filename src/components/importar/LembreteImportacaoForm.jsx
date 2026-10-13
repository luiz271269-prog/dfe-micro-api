import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hojeImportacao } from '@/lib/lembreteImportacao';
export default function LembreteImportacaoForm({tipo,config,onSaved}){
 const [frequencia,setFrequencia]=useState(config?.frequencia || 'semanal'),[data,setData]=useState(config?.primeira_data || hojeImportacao()),[ativo,setAtivo]=useState(config?.ativo ?? true),[busy,setBusy]=useState(false),[erro,setErro]=useState('');
 async function salvar(e){e.preventDefault();setBusy(true);setErro('');try{await base44.entities.LembreteImportacao.upsert([{tipo,frequencia,primeira_data:data,ativo}],{key:'tipo'});await onSaved();}catch(e){setErro(e.response?.data?.error || e.message);}finally{setBusy(false);}}
 return <form onSubmit={salvar} className="mt-3 flex flex-wrap items-end gap-3"><label className="text-xs">Frequência<select className="mt-1 block rounded border bg-background p-2" value={frequencia} onChange={e=>setFrequencia(e.target.value)}><option value="diaria">Diária</option><option value="semanal">Semanal</option><option value="mensal">Mensal</option></select></label><label className="text-xs">Primeiro lembrete<Input required type="date" value={data} onChange={e=>setData(e.target.value)} /></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ativo} onChange={e=>setAtivo(e.target.checked)} /> Ativo</label><Button size="sm" disabled={busy}>{busy?'Salvando…':'Salvar lembrete'}</Button>{erro&&<p role="alert" className="w-full text-xs text-destructive">{erro}</p>}</form>;
}