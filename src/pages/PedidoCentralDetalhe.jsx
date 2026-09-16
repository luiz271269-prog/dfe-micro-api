import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Package, Building2, CalendarDays, Receipt, Truck, History, Image as ImageIcon } from 'lucide-react';
import { buscarPedidoCentral } from '@/functions/buscarPedidoCentral';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import PageHeader from '@/components/shared/PageHeader';

export default function PedidoCentralDetalhe() {
  const { oc_numero } = useParams();
  const [estado, setEstado] = useState({ loading: true, data: null, erro: '' });

  async function carregar() {
    setEstado({ loading: true, data: null, erro: '' });
    try {
      const res = await buscarPedidoCentral({ oc_numero });
      const data = res.data;
      if (data?.ok) setEstado({ loading: false, data, erro: '' });
      else setEstado({ loading: false, data: null, erro: data?.motivo || 'Não foi possível carregar o pedido.' });
    } catch (e) {
      setEstado({ loading: false, data: null, erro: e?.response?.data?.motivo || e.message || 'Erro inesperado.' });
    }
  }

  useEffect(() => { carregar(); }, [oc_numero]);

  const pedido = estado.data?.pedido;
  const itens = estado.data?.itens || pedido?.itens || [];

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1200px] mx-auto">
      <PageHeader title={`Pedido ${oc_numero}`} subtitle="Visão completa do pedido na Central de Compras">
        <Link to="/compras"><Button variant="outline" className="gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</Button></Link>
      </PageHeader>

      {estado.loading && <p className="text-center py-16 text-muted-foreground">Carregando pedido…</p>}
      {estado.erro && !estado.loading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive font-medium">{estado.erro}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={carregar}>Tentar novamente</Button>
        </div>
      )}

      {pedido && !estado.loading && (
        <div className="space-y-6">
          {/* Cabeçalho do pedido */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-primary" /><p className="text-xs font-semibold uppercase text-muted-foreground">Fornecedor</p></div>
              <p className="font-bold text-foreground">{pedido.fornecedor_nome || '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">{pedido.fornecedor_cnpj || ''}</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2"><CalendarDays className="w-4 h-4 text-primary" /><p className="text-xs font-semibold uppercase text-muted-foreground">Data do Pedido</p></div>
              <p className="font-bold text-foreground">{formatDate(pedido.data_pedido || (pedido.created_date || '').slice(0, 10))}</p>
              <p className="text-xs text-muted-foreground mt-1">Empresa: {pedido.empresa || '—'}</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2"><Receipt className="w-4 h-4 text-primary" /><p className="text-xs font-semibold uppercase text-muted-foreground">Valor Total</p></div>
              <p className="text-xl font-bold text-foreground">{formatCurrency(pedido.valor_total || 0)}</p>
              <p className="text-xs mt-1">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${pedido.oc_finalizada ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {pedido.oc_finalizada ? 'Finalizada' : 'Em andamento'}
                </span>
              </p>
            </div>
          </div>

          {/* Dados complementares */}
          <div className="bg-card rounded-xl border p-4">
            <h3 className="text-sm font-bold mb-3">Dados do pedido</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Campo label="Nota Fiscal" valor={pedido.nota_fiscal_numero || '—'} />
              <Campo label="Parcelas" valor={String(pedido.parcelas ?? '—')} />
              <Campo label="Pagamento antecipado" valor={pedido.pagamento_antecipado ? 'Sim' : 'Não'} />
              <Campo label="Forma de pagamento" valor={pedido.condicao_pagamento || pedido.forma_pagamento || '—'} />
              <Campo label="Valor pago" valor={formatCurrency(pedido.valor_pago || 0)} />
              <Campo label="Valor ICMS-ST" valor={formatCurrency(pedido.valor_icms_st || 0)} />
              <Campo label="Tipo de frete" valor={pedido.tipo_frete || '—'} />
              <Campo label="Rastreamento" valor={pedido.rastreamento_codigo || '—'} />
            </div>
          </div>

          {/* Itens */}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
              <Package className="w-4 h-4 text-primary" /><h3 className="text-sm font-bold">Itens do pedido ({itens.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40">
                  <th className="p-3 text-left">Produto</th>
                  <th className="p-3 text-left hidden md:table-cell">Cód. fornecedor</th>
                  <th className="p-3 text-right">Qtd.</th>
                  <th className="p-3 text-right">Unitário</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-left hidden lg:table-cell">Status</th>
                </tr></thead>
                <tbody>
                  {itens.map((it, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-medium">{it.descricao || it.descricao_produto || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{it.codigo_fornecedor || '—'}</td>
                      <td className="p-3 text-right tabular-nums">{it.quantidade || 1}</td>
                      <td className="p-3 text-right tabular-nums">{formatCurrency(it.valor_unitario ?? 0)}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">{formatCurrency(it.valor_total ?? 0)}</td>
                      <td className="p-3 hidden lg:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{it.status_item || it.status_pagamento || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {itens.length > 0 && <tfoot><tr className="border-t-2 bg-muted/30">
                  <td colSpan={4} className="p-3 font-semibold text-right">Total</td>
                  <td className="p-3 text-right font-bold">{formatCurrency(itens.reduce((s, i) => s + (i.valor_total ?? 0), 0))}</td>
                  <td></td>
                </tr></tfoot>}
              </table>
            </div>
          </div>

          {/* Histórico de etapas */}
          {Array.isArray(pedido.historico_etapas) && pedido.historico_etapas.length > 0 && (
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-3"><History className="w-4 h-4 text-primary" /><h3 className="text-sm font-bold">Histórico</h3></div>
              <ol className="space-y-3">
                {pedido.historico_etapas.map((h, idx) => (
                  <li key={idx} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium">{h.texto || h.etapa || '—'}</p>
                      <p className="text-xs text-muted-foreground">{formatDate((h.data_hora || '').slice(0, 10))} · {h.autor_nome || 'Sistema'}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Imagem da OC */}
          {pedido.imagem_oc_url && (
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-3"><ImageIcon className="w-4 h-4 text-primary" /><h3 className="text-sm font-bold">Imagem da OC</h3></div>
              <a href={pedido.imagem_oc_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ExternalLink className="w-3.5 h-3.5" /> Abrir imagem
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Campo({ label, valor }) {
  return <div><p className="text-xs text-muted-foreground uppercase">{label}</p><p className="font-medium text-foreground mt-0.5">{valor}</p></div>;
}