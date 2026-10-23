import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { rotuloCampo } from '@/components/baixas/baixasService';
export default function BaixasEdicao({registro,campos,onSubmit}) {
  const [valores,setValores]=useState(Object.fromEntries(campos.map(k=>[k,registro.raw[k]||'']))),[motivo,setMotivo]=useState('');
  return <form className="space-y-3" onSubmit={e=>{e.preventDefault();const patch=Object.fromEntries(Object.entries(valores).filter(([k,v])=>v!==(registro.raw[k]||'')));if(!Object.keys(patch).length)return;onSubmit({acao:'editar',patch,motivo},Object.fromEntries(Object.entries(patch).map(([k,v])=>[rotuloCampo(k),`${registro.raw[k]||'Não informado'} → ${v}`])));}}>
    <p className="text-sm text-muted-foreground">Corrija identificação e classificação. Para alterar valor pago ou vínculo, use a reversão; os valores e datas do documento original permanecem protegidos.</p>
    {campos.map(k=><div key={k}><Label>{rotuloCampo(k)}</Label><Input type={k==='data_vencimento'?'date':'text'} value={valores[k]} maxLength={500} onChange={e=>setValores({...valores,[k]:e.target.value})}/></div>)}
    <div><Label>Motivo da correção</Label><Input value={motivo} minLength={10} maxLength={500} required onChange={e=>setMotivo(e.target.value)}/></div><Button type="submit">Revisar correção</Button>
  </form>;
}