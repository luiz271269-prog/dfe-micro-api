import { Button } from '@/components/ui/button';
import { Edit, Power, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { proximaPrevisao } from '@/components/recorrentes/fixasEngine';
export default function FixaPlanoLinha({regra:r,inicio,admin,onEditar,onToggle,onExcluir}) {
  const proxima=proximaPrevisao(r,`${inicio}-01`),d=r.realizado||{};
  const situacao=!r.is_ativa?'Inativa':r.revisao_cadastro?'Revisar cadastro':d.cartao?'Reconhecida no cartão; quitação na fatura':d.extrato?'Pagamento vinculado ao extrato':d.documentos?'Despesa registrada; pagamento pendente':'Prevista; ainda não realizada';
  return <article className="grid gap-3 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
    <div className="min-w-0"><h3 className="font-semibold break-words">{r.nome}</h3><p className="text-xs text-muted-foreground">{r.empresa||'Empresa não definida'} · {r.fornecedor||'Fornecedor não informado'}</p><p className="mt-1 text-xs text-muted-foreground">{{semanal:'Semanal',mensal:'Mensal',trimestral:'Trimestral',anual:'Anual'}[r.frequencia||'mensal']} · {{cartao:'Cartão',boleto:'Boleto',pix:'PIX',debito_automatico:'Débito automático',transferencia:'Transferência'}[r.forma_pagamento]||'Meio de pagamento não definido'}</p></div>
    <div className="text-sm"><p className="text-xs text-muted-foreground">Previsto por ocorrência</p><p className="font-semibold tabular-nums">{formatCurrency(r.valor_esperado)}</p><p className="text-xs text-muted-foreground mt-1">Próximo vencimento: {proxima?formatDate(proxima):'Não definido'}</p></div>
    <div className="text-sm"><p className="text-xs text-muted-foreground">Realizado no período</p><p className="font-semibold tabular-nums">{formatCurrency(d.valor||0)}</p><p className={r.revisao_cadastro?'text-xs text-warning mt-1':'text-xs text-muted-foreground mt-1'}>{situacao}</p></div>
    {admin&&<div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={()=>onEditar(r)}><Edit/>Editar</Button><Button size="icon" variant="ghost" onClick={()=>onToggle(r)} aria-label={r.is_ativa?'Desativar':'Ativar'}><Power/></Button><Button size="icon" variant="ghost" onClick={()=>onExcluir(r)} aria-label={`Excluir ${r.nome}`}><Trash2 className="text-destructive"/></Button></div>}
  </article>;
}