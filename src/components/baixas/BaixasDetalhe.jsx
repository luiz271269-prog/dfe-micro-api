import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import BaixasDados from '@/components/baixas/BaixasDados';
import BaixasPagamento from '@/components/baixas/BaixasPagamento';
import BaixasCandidatos from '@/components/baixas/BaixasCandidatos';
import BaixasEdicao from '@/components/baixas/BaixasEdicao';
import BaixasHistorico from '@/components/baixas/BaixasHistorico';
import BaixasMovimentos from '@/components/baixas/BaixasMovimentos';
import FaturaSeparacao from '@/components/cartoes/FaturaSeparacao';
import CartaoCabecalho from '@/components/baixas/cartao/CartaoCabecalho';
import CartaoSugestoes from '@/components/baixas/cartao/CartaoSugestoes';
import CartaoVinculoAtual from '@/components/baixas/cartao/CartaoVinculoAtual';
export default function BaixasDetalhe({detalhe,onSubmit,abaInicial='dados',contexto={}}) {
  const [aba,setAba]=useState(abaInicial);
  if(!detalhe)return null;
  const r=detalhe.registro,mov=['LancamentoBancario','LancamentoCartao'].includes(r.tipo),cartao=r.tipo==='LancamentoCartao';
  const central=cartao&&!!r.raw.pedido_central_internal_id;
  const noCartao=r.estado==='no_cartao'||!!r.raw.lancamento_cartao_id||detalhe.trilhas.some(t=>t.fase!=='cancelado');
  const vinculado=detalhe.vinculos.length>0||noCartao||!!r.raw.lancamento_bancario_id;
  const podePagar=!mov&&r.saldo>0&&!vinculado&&(detalhe.admin||r.tipo==='FaturaCartao');
  const podeConciliar=detalhe.admin&&(central||(r.saldo>0&&!noCartao&&r.estado!=='bloqueado'));
  const conciliar=[['conciliar',cartao?'Vincular compra / despesa':r.tipo==='FaturaCartao'?'Conciliar pagamento bancário':'Conferir banco / composição']];
  const abas=[...(cartao&&podeConciliar?conciliar:[]),['dados',cartao?'Dados da transação':'Documento e análise'],...(podePagar?[['pagar','Declarar pagamento']]:[]),...(!cartao&&podeConciliar?conciliar:[]),...(detalhe.admin?[['editar','Corrigir dados']]:[]),['historico','Histórico e reversões']];
  const atual=abas.some(([v])=>v===aba)?aba:abas[0][0];
  return <section className="border rounded-xl bg-card overflow-hidden">
    {cartao?<CartaoCabecalho registro={r} detalhe={detalhe} local={noCartao||!!r.raw.item_compra_id}/>:<div className="p-4 border-b"><p className="text-xs uppercase tracking-wide text-primary font-semibold">Registro selecionado na origem</p><h2 className="font-semibold mt-1">{r.descricao}</h2><div className="grid grid-cols-3 gap-3 mt-4 text-sm"><div><p className="text-xs text-muted-foreground">Total</p><b>{formatCurrency(r.total)}</b></div><div><p className="text-xs text-muted-foreground">{noCartao?'Obrigação própria':mov?'Disponível':'Saldo'}</p><b>{noCartao?'Integra a fatura':formatCurrency(r.saldo)}</b></div><div><p className="text-xs text-muted-foreground">Situação</p><b className="break-words">{noCartao?'Incluído na fatura':r.estado.replaceAll('_',' ')}</b></div></div></div>}
    <div className="p-4 space-y-4">
    <div className="flex flex-wrap gap-2">{abas.map(([v,t])=><Button key={v} size="sm" variant={atual===v?'default':'outline'} onClick={()=>setAba(v)}>{t}</Button>)}</div>
    {!detalhe.admin&&<p className="text-xs text-muted-foreground">Conciliação, correção e reversão exigem administrador. A declaração de pagamento da própria fatura mantém a permissão do módulo.</p>}
    {r.saldo<=0&&!noCartao&&!central&&<p role="status" className="rounded-lg border p-3 text-sm text-success">Sem saldo disponível para nova baixa. Consulte o histórico para conferir ou reverter a operação.</p>}
    {noCartao&&<p className="text-sm text-muted-foreground">{cartao?'Transação já vinculada a um documento local (compra, despesa ou obra). Para trocar, cancele o vínculo em “Histórico e reversões”.':'Documento reconhecido no cartão: o pagamento bancário deve ser conciliado na fatura, sem baixar este item novamente.'}</p>}
    {atual==='dados'&&<>{r.tipo==='FaturaCartao'&&<FaturaSeparacao faturaId={r.id} versao={r.versao}/>}<BaixasDados dados={r.raw} titulo={noCartao?'Dados históricos da origem (não representam a quitação da fatura)':'Dados completos da origem'}/><p className="text-sm text-muted-foreground">{podeConciliar?(cartao?'Em “Vincular compra / despesa”, compare com os pedidos da Central e os documentos registrados. ':'Em “Conciliar evidência”, analise correspondências de banco ou cartão deste documento. '):''}{podePagar?'Em “Declarar pagamento”, informe uma baixa sem vínculo bancário. ':''}Nada é alterado durante a análise; cada operação exige conferência e confirmação.</p>{r.raw.regra_recorrente_id&&<p className="text-xs text-primary">A regra da despesa fixa e a competência original são preservadas.</p>}</>}
    {atual==='pagar'&&podePagar&&<BaixasPagamento key={r.versao} registro={r} onSubmit={onSubmit}/>}
    {atual==='conciliar'&&podeConciliar&&(cartao?(central?<CartaoVinculoAtual key={r.versao} registro={r} onSubmit={onSubmit}/>:<CartaoSugestoes key={r.versao} registro={r} onSubmit={onSubmit}/>):mov?<BaixasCandidatos key={r.versao} registro={r} onSubmit={onSubmit}/>:<BaixasMovimentos key={r.versao} registro={r} onSubmit={onSubmit} contexto={contexto}/>)}
    {atual==='editar'&&detalhe.admin&&<BaixasEdicao key={r.versao} registro={r} campos={detalhe.editaveis} onSubmit={onSubmit}/>}
    {atual==='historico'&&<BaixasHistorico detalhe={detalhe} onSubmit={onSubmit}/>}
  </div></section>;
}