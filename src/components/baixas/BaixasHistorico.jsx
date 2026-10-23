import BaixasDados from '@/components/baixas/BaixasDados';
import BaixasReversao from '@/components/baixas/BaixasReversao';
import { formatCurrency } from '@/lib/formatters';
function ler(json){try{return JSON.parse(json||'{}');}catch{return {};}}
export default function BaixasHistorico({detalhe,onSubmit}) {
  const {vinculos,trilhas,auditoria,registro,evidencias,admin}=detalhe;
  return <div className="space-y-4"><h3 className="font-semibold">Vínculos e evidências</h3>
    {!vinculos.length&&!trilhas.length&&!evidencias.length&&<p className="text-sm text-muted-foreground">Nenhum vínculo ou evidência indexada para este registro.</p>}
    {vinculos.map(v=><article key={v.id} className="border rounded-lg p-3"><p className="text-sm font-semibold">Extrato · {v.entidade_tipo} · {formatCurrency(v.valor_alocado)}</p><BaixasDados dados={v} titulo="Dados do vínculo bancário"/>{admin&&<BaixasReversao acao="removerBanco" params={{vinculo_id:v.id}} descricao="Desvincular extrato" onSubmit={onSubmit}/>}</article>)}
    {trilhas.map(v=><article key={v.id} className="border rounded-lg p-3"><p className="text-sm font-semibold">Cartão · {v.fase} · {formatCurrency(v.valor_alocado)}</p><BaixasDados dados={v} titulo="Trilha do reconhecimento de compra"/>{admin&&v.fase==='confirmado'&&<BaixasReversao acao="cancelarCartao" params={{vinculo_id:v.id}} descricao="Cancelar vínculo de cartão" onSubmit={onSubmit}/>}</article>)}
    {evidencias.map(e=><BaixasDados key={e.id} dados={e} titulo={`Evidência ${e.tipo} · ${e.estado}`}/>)}
    <h3 className="font-semibold">Pagamentos declarados na origem</h3>{!(registro.raw.pagamentos_manuais||[]).length&&<p className="text-sm text-muted-foreground">Consulte também a auditoria abaixo; alguns módulos não mantêm uma lista própria de pagamentos.</p>}
    {(registro.raw.pagamentos_manuais||[]).map((p,i,arr)=><article key={p.id} className="border rounded-lg p-3"><p className="text-sm">{p.data} · {p.forma} · {formatCurrency(p.valor)}</p>{admin&&i===arr.length-1&&<BaixasReversao acao="reabrirManual" params={{pagamento_id:p.id}} descricao="Reabrir último pagamento declarado" onSubmit={onSubmit}/>}</article>)}
    <h3 className="font-semibold">Auditoria · antes e depois</h3>{!auditoria.length&&<p className="text-sm text-muted-foreground">Sem eventos disponíveis nesta consulta.</p>}
    {auditoria.map(a=>{const meta=ler(a.payload_original);return <article key={a.id} className="border rounded-lg p-3 space-y-2"><p className="text-sm font-semibold">{a.acao} · {meta.operacao||'Operação da origem'}</p><p className="text-xs text-muted-foreground">{a.created_date} · Autor: {meta.usuario_id||a.created_by_id||'Registrado na origem'}</p><p className="text-sm">{a.motivo}</p><BaixasDados dados={{antes:ler(a.payload_original),resultado:ler(a.detalhe)}} titulo="Conferir estado anterior e resultado"/>{admin&&meta.origem==='central_baixas'&&['manual','editar'].includes(meta.operacao)&&a.acao==='vinculo_confirmado'&&<BaixasReversao acao="reabrir" params={{auditoria_id:a.id}} descricao="Restaurar estado anterior desta operação" onSubmit={onSubmit}/>}</article>;})}
    {detalhe.historicoMais&&<p className="text-xs text-muted-foreground">Exibindo os 60 eventos mais recentes. Eventos anteriores permanecem preservados.</p>}
  </div>;
}