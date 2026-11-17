import CartaoCandidatoCentral from '@/components/baixas/cartao/CartaoCandidatoCentral';
import CartaoVinculoForm from '@/components/baixas/cartao/CartaoVinculoForm';

export default function CartaoSecaoCentral({ central, registro, sel, onSelect, onSubmit }) {
  const ativo = c => sel?.origem === 'central' && sel.id === c.id;
  return <section className="space-y-2">
    <h3 className="text-sm font-semibold">Pedidos da Central de Compras</h3>
    {!central.ok && <p role="alert" className="rounded-lg border p-3 text-sm text-warning">{central.motivo}</p>}
    {central.ok && !central.candidatos.length && <p className="text-sm text-muted-foreground">Nenhum pedido com valor, parcela ou fornecedor compatível. Busque pelo fornecedor ou nº do pedido.</p>}
    {central.candidatos.map(c => <CartaoCandidatoCentral key={c.id} c={c} selecionado={ativo(c)} onSelect={() => onSelect({ ...c, origem: 'central' })}>
      {ativo(c) && <CartaoVinculoForm registro={registro} candidato={sel} onSubmit={onSubmit} />}
    </CartaoCandidatoCentral>)}
    {central.ignorados > 0 && <p className="text-xs text-muted-foreground">{central.ignorados} pedido(s) sem câmbio informado não foram comparados.</p>}
  </section>;
}