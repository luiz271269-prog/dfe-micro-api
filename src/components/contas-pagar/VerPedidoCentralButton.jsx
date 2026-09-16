import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VerPedidoCentralButton({ compra }) {
  if (!compra?.pedido_central_id) return null;
  function abrirPedido(event) {
    event.stopPropagation();
    const url = new URL('https://nexus-cotacoes360.base44.app/solicitacoes');
    url.searchParams.set('aba', 'pedidos');
    url.searchParams.set('oc_numero', compra.pedido_central_id);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }
  return <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={abrirPedido} title={`Abrir ${compra.pedido_central_id} na Central em nova aba`}>
    <ExternalLink className="w-3 h-3" /> Ver pedido completo
  </Button>;
}