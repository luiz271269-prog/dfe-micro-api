import { fontesBaixas } from '@/components/baixas/baixasService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
export default function BaixasFiltros({filtros,onChange,onApply,loading}) {
  const set=(k,v)=>onChange({...filtros,[k]:v});
  return <form onSubmit={e=>{e.preventDefault();onApply();}} className="bg-card border rounded-xl p-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
    <div className="lg:col-span-2"><Label>Fonte / módulo</Label><select className="w-full border rounded-md p-2 bg-background text-sm" value={filtros.tipo} onChange={e=>set('tipo',e.target.value)}>{Object.entries(fontesBaixas).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></div>
    <div><Label>Período da origem</Label><Input type="month" value={filtros.mes} onChange={e=>set('mes',e.target.value)}/></div>
    <div><Label>Empresa</Label><select className="w-full border rounded-md p-2 bg-background text-sm" value={filtros.empresa} onChange={e=>set('empresa',e.target.value)}>{['todas','NeuralTec','Liesch'].map(v=><option key={v} value={v}>{v==='todas'?'Todas':v}</option>)}</select></div>
    <div><Label>Situação da origem</Label><select className="w-full border rounded-md p-2 bg-background text-sm" value={filtros.estado} onChange={e=>set('estado',e.target.value)}><option value="todos">Todas</option>{filtros.tipo!=='LancamentoCartao'&&(filtros.tipo==='LancamentoBancario'?['pendente','parcial','pago','bloqueado']:['pendente','parcial','pago']).map(v=><option key={v} value={v}>{v}</option>)}</select></div>
    <div><Label>Canal informado</Label><select disabled={['LancamentoBancario','LancamentoCartao','FaturaCartao','Tributo'].includes(filtros.tipo)} className="w-full border rounded-md p-2 bg-background text-sm disabled:opacity-50" value={filtros.canal} onChange={e=>set('canal',e.target.value)}>{['todos','pix','boleto','transferencia','dinheiro','cartao','debito_automatico'].map(v=><option key={v} value={v}>{v}</option>)}</select></div>
    <div className="sm:col-span-2 lg:col-span-5"><Label>Descrição, contraparte ou referência</Label><Input value={filtros.busca} onChange={e=>set('busca',e.target.value)} placeholder="Buscar na fonte selecionada..."/></div><Button disabled={loading} className="self-end">{loading?'Consultando...':'Consultar'}</Button>
    <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-6">Período: emissão das compras; competência de folha/fatura; vencimento de tributos; data do registro nas demais fontes. Limpe o mês para localizar documentos de outros períodos.</p>
  </form>;
}