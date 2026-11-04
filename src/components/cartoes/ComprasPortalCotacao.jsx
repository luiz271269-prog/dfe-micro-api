import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShoppingCart } from 'lucide-react';
import { buscarComprasCentral } from '@/functions/buscarComprasCentral';
import { Button } from '@/components/ui/button';
import ComprasTitulosTable from '@/components/compras/ComprasTitulosTable';
import { consolidarDocumentosCompras } from '@/lib/documentosCompras';

export default function ComprasPortalCotacao({ onPedidos, selectedMonth, isAnnual = false }) {
  const [estado, setEstado] = useState({ loading: true, data: null, erro: '' });
  const periodo = selectedMonth ? (isAnnual ? selectedMonth.slice(0, 4) : selectedMonth) : '';
  async function carregar(ativo = () => true) {
    setEstado({ loading: true, data: null, erro: '' });
    try {
      const { data } = await buscarComprasCentral(selectedMonth ? { mes: selectedMonth, anual: isAnnual } : {});
      if (!ativo()) return;
      setEstado(data?.ok ? { loading: false, data, erro: '' } : { loading: false, data: null, erro: data?.motivo || 'Não foi possível ler o portal.' });
      onPedidos?.(data?.ok ? data.pedidos_referencias || [] : []);
    } catch (error) {
      if (!ativo()) return;
      setEstado({ loading: false, data: null, erro: error.response?.data?.motivo || (error.response?.status === 403 ? 'A consulta de pedidos é restrita a administradores (HTTP 403).' : 'Não foi possível consultar o portal. Tente atualizar novamente.') });
      onPedidos?.([]);
    }
  }
  useEffect(() => { let ativo = true; carregar(() => ativo); return () => { ativo = false; }; }, [selectedMonth, isAnnual]);
  const documentos = useMemo(() => consolidarDocumentosCompras(estado.data?.itens || []).filter(doc => !periodo || (doc.data_vencimento || doc.data_emissao || '').startsWith(periodo)), [estado.data, periodo]);
  return <section className="bg-card rounded-xl border overflow-hidden mb-6">
    <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
      <ShoppingCart className="w-4 h-4 text-primary" /><h2 className="text-sm font-bold">Contas a pagar do Portal de Cotação</h2>
      {estado.data && <span className="text-xs text-muted-foreground">{documentos.length} títulos em aberto</span>}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => carregar()} disabled={estado.loading}><RefreshCw className={`w-3.5 h-3.5 ${estado.loading ? 'animate-spin' : ''}`} /> Atualizar</Button>
    </header>
    <p className="px-4 py-2 text-xs text-muted-foreground">Consulta online, somente leitura. Os pedidos não são importados para o financeiro.</p>
    {estado.erro && <p role="alert" className="m-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">{estado.erro}</p>}
    {!estado.erro && <ComprasTitulosTable documentos={documentos} loading={estado.loading} embedded />}
  </section>;
}