import { useState, useMemo, Fragment } from 'react';
import { Package, ChevronDown, ChevronRight, TrendingUp, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { Input } from '@/components/ui/input';

const SAUDE = {
  ok:      { label: 'OK',       icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-100' },
  parcial: { label: 'Parcial',  icon: AlertCircle,  color: 'text-amber-600 bg-amber-100' },
  critico: { label: 'Crítico',  icon: XCircle,      color: 'text-rose-600 bg-rose-100' },
};

export default function TabelaGruposSKU({ grupos }) {
  const [busca, setBusca] = useState('');
  const [expandido, setExpandido] = useState(new Set());

  const filtrados = useMemo(() => {
    if (!busca) return grupos;
    const b = busca.toLowerCase();
    return grupos.filter(g =>
      g.descricao_canonica?.toLowerCase().includes(b) ||
      g.categoria?.toLowerCase().includes(b) ||
      g.fornecedores.some(f => f.toLowerCase().includes(b))
    );
  }, [grupos, busca]);

  function toggle(key) {
    const next = new Set(expandido);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandido(next);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Input placeholder="Buscar produto, categoria, fornecedor..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />
        <p className="text-xs text-muted-foreground">{filtrados.length} grupos · {filtrados.reduce((s, g) => s + g.itens.length, 0)} compras</p>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="w-6"></th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Produto (SKU virtual)</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Categoria</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Qtd</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Custo médio</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Variação</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Total gasto</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Fornec.</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">3-way</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(g => {
                const isOpen = expandido.has(g.sku_key);
                const saude = SAUDE[g.saude_pagamento];
                const Icon = saude.icon;
                return (
                  <Fragment key={g.sku_key}>
                    <tr className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => toggle(g.sku_key)}>
                      <td className="px-2 py-2">{isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                      <td className="px-3 py-2 font-semibold max-w-[260px] truncate">{g.descricao_canonica}</td>
                      <td className="px-3 py-2"><span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{g.categoria}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.total_quantidade}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(g.custo_medio)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-bold ${g.variacao_preco_percentual > 20 ? 'text-rose-600' : g.variacao_preco_percentual > 10 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {g.variacao_preco_percentual > 0 ? `${g.variacao_preco_percentual.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">{formatCurrency(g.total_gasto)}</td>
                      <td className="px-3 py-2 text-center">{g.qtd_fornecedores}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${saude.color}`}>
                          <Icon className="w-3 h-3" /> {saude.label}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={9} className="bg-muted/20 p-0">
                          <div className="p-3">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">{g.itens.length} compra(s) — histórico</p>
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="border-b border-border/50">
                                  <th className="text-left py-1 text-muted-foreground">Data</th>
                                  <th className="text-left py-1 text-muted-foreground">Fornecedor</th>
                                  <th className="text-left py-1 text-muted-foreground">NF</th>
                                  <th className="text-right py-1 text-muted-foreground">Qtd</th>
                                  <th className="text-right py-1 text-muted-foreground">Unit.</th>
                                  <th className="text-right py-1 text-muted-foreground">Total</th>
                                  <th className="text-center py-1 text-muted-foreground">Pagto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.itens.map(i => (
                                  <tr key={i.id} className="border-b border-border/30">
                                    <td className="py-1 whitespace-nowrap">{formatDate(i.data_emissao)}</td>
                                    <td className="py-1 truncate max-w-[180px]">{i.fornecedor}</td>
                                    <td className="py-1">{i.numero_nota || '—'}</td>
                                    <td className="py-1 text-right">{i.quantidade}</td>
                                    <td className="py-1 text-right tabular-nums">{i.valor_unitario ? formatCurrency(i.valor_unitario) : '—'}</td>
                                    <td className="py-1 text-right tabular-nums font-semibold">{formatCurrency(i.valor_total)}</td>
                                    <td className="py-1 text-center">
                                      {i.status_pagamento === 'pago' ? (
                                        <span className="text-emerald-600 text-[10px] font-bold">✓ PAGO</span>
                                      ) : (
                                        <span className="text-amber-600 text-[10px] font-bold">PENDENTE</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}