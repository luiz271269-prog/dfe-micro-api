import { ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import BaixasFiltros from '@/components/baixas/BaixasFiltros';
import BaixasLista from '@/components/baixas/BaixasLista';
import BaixasDetalhe from '@/components/baixas/BaixasDetalhe';
import BaixasConfirmacao from '@/components/baixas/BaixasConfirmacao';
import useBaixas from '@/components/baixas/useBaixas';
export default function Baixas() {
  const b=useBaixas();
  return <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-5">
    <PageHeader title="Central de Baixas" subtitle="Obrigações, pagamentos e evidências em um só lugar"/>
    <div className="bg-card border rounded-xl p-4 flex gap-3"><ShieldCheck className="text-primary shrink-0"/><div><h2 className="font-semibold">Três operações, sem misturar os efeitos</h2><p className="text-sm text-muted-foreground">Declare como foi pago sem extrato, concilie um débito bancário ou reconheça uma compra no cartão. Reconhecer a compra não quita a fatura; toda alteração exige conferência individual.</p></div></div>
    <BaixasFiltros filtros={b.filtros} onChange={b.setFiltros} onApply={b.aplicar} loading={b.loading}/>
    {b.erro&&!b.confirmacao&&<p role="alert" className="border border-destructive text-destructive rounded-lg p-3 text-sm">{b.erro}</p>}
    {b.sucesso&&<p role="status" className="border border-success text-success rounded-lg p-3 text-sm">{b.sucesso}</p>}
    <div className="grid xl:grid-cols-2 gap-5 items-start"><BaixasLista items={b.items} selecionado={b.detalhe?.registro} onSelect={b.selecionar} loading={b.loading} mais={b.pagina.has_more} onMore={()=>b.consultar(true)}/><BaixasDetalhe key={b.detalhe?`${b.detalhe.registro.tipo}-${b.detalhe.registro.id}`:'vazio'} detalhe={b.detalhe} onSubmit={b.solicitar}/></div>
    <BaixasConfirmacao operacao={b.confirmacao} onClose={()=>b.setConfirmacao(null)} onConfirm={b.executar} busy={b.busy} erro={b.erro}/>
  </div>;
}