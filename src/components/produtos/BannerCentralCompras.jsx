import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BannerCentralCompras({ status, onRetry }) {
  if (!status) return null;

  if (status.ok) {
    return (
      <div className="flex items-center gap-2 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span className="font-semibold">Conectado à Central de Compras</span>
        <span className="opacity-80">· {status.pedidos_count} pedido(s) lido(s) em tempo real</span>
        <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-emerald-800" onClick={onRetry}>
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold">Não foi possível conectar à Central de Compras</p>
        <p className="opacity-80 mt-0.5">{status.motivo}</p>
      </div>
      <Button variant="outline" size="sm" className="h-7 gap-1 shrink-0" onClick={onRetry}>
        <RefreshCw className="w-3 h-3" /> Tentar novamente
      </Button>
    </div>
  );
}