import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function BaixasReversao({acao,params,descricao,onSubmit}) {
  const [motivo,setMotivo]=useState('');
  return <form className="flex flex-col sm:flex-row gap-2 mt-2" onSubmit={e=>{e.preventDefault();onSubmit({acao,...params,motivo},{operação:descricao,efeito:acao==='fixasConfirmar'?'Confirmar a ocorrência da regra existente e vincular a evidência; preservar a competência.':'Restaurar o estado permitido e recalcular os saldos afetados; preservar a auditoria.'});}}><Input placeholder="Motivo da reversão (mín. 10 caracteres)" minLength={10} maxLength={500} required value={motivo} onChange={e=>setMotivo(e.target.value)}/><Button variant="outline" type="submit">{acao==='fixasConfirmar'?'Revisar confirmação':'Revisar reversão'}</Button></form>;
}