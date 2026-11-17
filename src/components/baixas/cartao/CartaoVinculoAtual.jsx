import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import BaixasReversao from '@/components/baixas/BaixasReversao';

export default function CartaoVinculoAtual({ registro, onSubmit }) {
  const r = registro.raw;
  return <div className="space-y-2 rounded-lg border border-success/30 bg-success/5 p-3">
    <p className="text-sm font-semibold">Vinculada ao pedido {r.pedido_central_id} da Central de Compras</p>
    <p className="text-sm">{r.pedido_central_fornecedor} · parcela {r.pedido_central_parcela}/{r.pedido_central_parcelas} · pedido de {formatCurrency(r.pedido_central_valor)}</p>
    {r.pedido_central_condicao && <p className="text-xs text-muted-foreground">Pagamento na Central: {r.pedido_central_condicao}</p>}
    <Link to={`/pedido-central/${encodeURIComponent(r.pedido_central_id)}`} className="text-xs text-primary underline">Abrir pedido</Link>
    <p className="text-xs text-muted-foreground">O pedido continua sendo lido da Central; esta referência identifica a compra que compõe a fatura e não quita a fatura.</p>
    <BaixasReversao acao="desfazerCentral" params={{}} descricao="Desfazer vínculo com o pedido da Central" onSubmit={onSubmit} />
  </div>;
}