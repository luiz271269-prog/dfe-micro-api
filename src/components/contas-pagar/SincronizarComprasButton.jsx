import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

/** Puxa os pedidos do app Central de Compras para o Contas a Pagar (ItemCompra). */
export default function SincronizarComprasButton({ onDone }) {
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function sincronizar() {
    if (rodando) return;
    setRodando(true);
    setResultado(null);
    try {
      const { data } = await base44.functions.sincronizarComprasCentral({});
      if (data?.error || data?.motivo && !data?.ok) throw new Error(data.error || data.motivo);
      setResultado(`${data.criados} nova(s) · ${data.atualizados} atualizada(s)`);
      onDone?.();
    } catch (err) {
      setResultado(`Erro: ${err.message}`);
    }
    setRodando(false);
  }

  return (
    <div className="flex items-center gap-2">
      {resultado && <span className="text-xs text-muted-foreground">{resultado}</span>}
      <Button onClick={sincronizar} disabled={rodando} size="sm" variant="outline" className="gap-1.5">
        <RefreshCw className={`w-3.5 h-3.5 ${rodando ? 'animate-spin' : ''}`} />
        {rodando ? 'Sincronizando...' : 'Central de Compras'}
      </Button>
    </div>
  );
}