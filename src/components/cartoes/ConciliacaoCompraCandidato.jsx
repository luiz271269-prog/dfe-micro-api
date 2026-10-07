import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
const rotas={ItemCompra:'/compras',DespesaOperacional:'/despesas',ObraReforma:'/obras'};
export default function ConciliacaoCompraCandidato({row,candidato:c,busy,onConfirm}) {
  const [motivo,setMotivo]=useState('');
  return <div className="border rounded-lg p-3 space-y-2">
    <div className="flex justify-between gap-3 text-sm"><span className="font-medium">{c.tipo} · {c.descricao}</span><span className="font-semibold whitespace-nowrap">{formatCurrency(c.valor)}</span></div>
    <p className="text-xs text-muted-foreground">{formatDate(c.data)} · {c.fornecedor||'Fornecedor ausente'} · {c.empresa||'Empresa ausente'}</p>
    <p className="text-xs">Classificação do documento: {c.origem_compra||'Pendente'} / {c.tipo_compra||'Pendente'}</p>
    <p className="text-xs text-muted-foreground">{c.auto?'Evidências completas':c.motivos.join(' · ')} · Diferença de datas: {c.dias} dia(s)</p>
    <Link className="text-xs text-primary underline" to={rotas[c.tipo]}>Conferir documento no módulo · {c.id}</Link>
    <label className="block text-xs">Evidência conferida<Input aria-label="Evidência para confirmar vínculo" value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={500} placeholder="Explique como conferiu esta correspondência" disabled={busy}/></label>
    <Button size="sm" variant="outline" disabled={busy||motivo.trim().length<10} onClick={()=>onConfirm({lancamento_cartao_id:row.id,entidade_tipo:c.tipo,entidade_id:c.id,versao:c.versao,motivo})}>Confirmar este vínculo</Button>
  </div>;
}