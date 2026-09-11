import { useEffect, useState } from 'react';
import { RefreshCw, ShoppingCart } from 'lucide-react';
import { buscarComprasCentral } from '@/functions/buscarComprasCentral';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function ComprasPortalCotacao() {
  const [estado, setEstado] = useState({ loading: true, data: null, erro: '' });
  async function carregar() {
    setEstado({ loading: true, data: null, erro: '' });
    const { data } = await buscarComprasCentral({});
    setEstado(data?.ok ? { loading: false, data, erro: '' } : { loading: false, data: null, erro: data?.motivo || 'Não foi possível ler o portal.' });
  }
  useEffect(() => { carregar(); }, []);
  return <section className="bg-card rounded-xl border overflow-hidden mb-6">
    <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
      <ShoppingCart className="w-4 h-4 text-primary" /><h2 className="text-sm font-bold">Compras do Portal de Cotação</h2>
      {estado.data && <span className="text-xs text-muted-foreground">{estado.data.pedidos_count} pedidos · {estado.data.itens.length} itens</span>}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={carregar} disabled={estado.loading}><RefreshCw className={`w-3.5 h-3.5 ${estado.loading ? 'animate-spin' : ''}`} /> Atualizar</Button>
    </header>
    {estado.erro && <p role="alert" className="m-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">{estado.erro}</p>}
    {estado.loading && <p className="p-6 text-center text-sm text-muted-foreground">Lendo compras do portal…</p>}
    {estado.data && <div className="max-h-80 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-card"><tr className="border-b"><th className="p-2 text-left">Pedido</th><th className="p-2 text-left">Fornecedor / item</th><th className="p-2 text-left">Data</th><th className="p-2 text-right">Valor</th><th className="p-2 text-left">Status</th></tr></thead><tbody>{estado.data.itens.map(item => <tr key={item.id} className="border-b last:border-0"><td className="p-2 font-semibold">{item.pedido || '—'}</td><td className="p-2"><p>{item.fornecedor}</p><p className="text-muted-foreground">{item.descricao_produto}</p></td><td className="p-2">{formatDate(item.data_emissao)}</td><td className="p-2 text-right font-semibold tabular-nums">{formatCurrency(item.valor_total)}</td><td className="p-2">{item.status_pagamento || '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}