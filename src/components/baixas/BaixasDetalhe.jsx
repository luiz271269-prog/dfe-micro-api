import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import BaixasDados from '@/components/baixas/BaixasDados';
import BaixasPagamento from '@/components/baixas/BaixasPagamento';
import BaixasCandidatos from '@/components/baixas/BaixasCandidatos';
import BaixasEdicao from '@/components/baixas/BaixasEdicao';
import BaixasHistorico from '@/components/baixas/BaixasHistorico';
export default function BaixasDetalhe({detalhe,onSubmit}) {
  const [aba,setAba]=useState('dados');
  if(!detalhe)return <section className="border rounded-xl bg-card p-6"><h2 className="font-semibold">Detalhes e evidências</h2><p className="text-sm text-muted-foreground mt-2">Selecione um registro para conferir dados completos, histórico e operações disponíveis.</p></section>;
  const r=detalhe.registro,mov=['LancamentoBancario','LancamentoCartao'].includes(r.tipo);
  const abas=[['dados','Dados completos'],...(detalhe.admin?[[mov?'conciliar':'pagar',mov?'Buscar conciliação':'Pagar sem extrato'],['editar','Corrigir dados']]:[]),['historico','Histórico e reversões']];
  return <section className="border rounded-xl bg-card overflow-hidden"><div className="p-4 border-b"><p className="text-xs uppercase tracking-wide text-primary font-semibold">Registro selecionado</p><h2 className="font-semibold mt-1">{r.descricao}</h2><div className="grid grid-cols-3 gap-3 mt-4 text-sm"><div><p className="text-xs text-muted-foreground">Total</p><b>{formatCurrency(r.total)}</b></div><div><p className="text-xs text-muted-foreground">{mov?'Disponível':'Saldo'}</p><b>{formatCurrency(r.saldo)}</b></div><div><p className="text-xs text-muted-foreground">Situação</p><b className="break-words">{r.estado.replaceAll('_',' ')}</b></div></div></div><div className="p-4 space-y-4"><div className="flex flex-wrap gap-2">{abas.map(([v,t])=><Button key={v} size="sm" variant={aba===v?'default':'outline'} onClick={()=>setAba(v)}>{t}</Button>)}</div>
    {!detalhe.admin&&<p className="text-xs text-muted-foreground">Consulta conforme seu acesso. Operações financeiras da central exigem administrador.</p>}
    {aba==='dados'&&<><BaixasDados dados={r.raw}/><p className="text-sm text-muted-foreground">Para conciliar uma obrigação, localize o débito em “Extrato bancário” ou a compra em “Compras no cartão”. Nenhuma sugestão é confirmada automaticamente.</p>{r.raw.regra_recorrente_id&&<p className="text-xs text-primary">Documento de despesa fixa já materializado: sua regra e sua competência são preservadas.</p>}</>}
    {aba==='pagar'&&detalhe.admin&&<BaixasPagamento key={r.versao} registro={r} onSubmit={onSubmit}/>}
    {aba==='conciliar'&&detalhe.admin&&<BaixasCandidatos key={r.versao} registro={r} onSubmit={onSubmit}/>}
    {aba==='editar'&&detalhe.admin&&<BaixasEdicao key={r.versao} registro={r} campos={detalhe.editaveis} onSubmit={onSubmit}/>}
    {aba==='historico'&&<BaixasHistorico detalhe={detalhe} onSubmit={onSubmit}/>}
  </div></section>;
}