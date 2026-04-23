import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { vincularCompraPagamento } from '@/functions/vincularCompraPagamento';
import { desvincularCompraPagamento } from '@/functions/desvincularCompraPagamento';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link2, Unlink, CreditCard, Landmark, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { acharPagamentosParaCompra, nivelConfianca } from '../../lib/compraPagamentoEngine';

const STATUS_CFG = {
  pago: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Pago', icon: CheckCircle2 },
  parcial: { color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Parcial', icon: AlertTriangle },
  pendente: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pendente', icon: AlertTriangle },
  nao_identificado: { color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Não identificado', icon: HelpCircle },
};

const CONF_CFG = {
  alta: { color: 'bg-emerald-100 text-emerald-700', label: 'Alta' },
  media: { color: 'bg-amber-100 text-amber-700', label: 'Média' },
  baixa: { color: 'bg-rose-100 text-rose-700', label: 'Baixa' },
};

export default function MatchingCompraPagamento({ compras, lancamentosBanco, lancamentosCartao, onRefresh }) {
  const [compraAberta, setCompraAberta] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Agrupa compras por status
  const stats = useMemo(() => {
    const s = { pago: 0, pendente: 0, parcial: 0, nao_identificado: 0, totalValor: 0, pagoValor: 0 };
    compras.forEach(c => {
      const st = c.status_pagamento || 'nao_identificado';
      s[st] = (s[st] || 0) + 1;
      s.totalValor += c.valor_total || 0;
      if (st === 'pago') s.pagoValor += c.valor_total || 0;
    });
    return s;
  }, [compras]);

  const candidatos = useMemo(() => {
    if (!compraAberta) return [];
    return acharPagamentosParaCompra(compraAberta, { lancamentosBanco, lancamentosCartao }).slice(0, 8);
  }, [compraAberta, lancamentosBanco, lancamentosCartao]);

  async function vincular(tipo, ref_id) {
    setSalvando(true);
    await vincularCompraPagamento({ item_compra_id: compraAberta.id, tipo, ref_id });
    setSalvando(false);
    setCompraAberta(null);
    onRefresh?.();
  }

  async function desvincular(compra) {
    if (!confirm('Remover vínculo de pagamento desta compra?')) return;
    setSalvando(true);
    await desvincularCompraPagamento({ item_compra_id: compra.id });
    setSalvando(false);
    onRefresh?.();
  }

  // Auto-vincular alta confiança em lote
  async function autoVincularLote() {
    const pendentes = compras.filter(c => (c.status_pagamento || 'nao_identificado') !== 'pago');
    let vinculados = 0;
    setSalvando(true);
    for (const c of pendentes) {
      const cands = acharPagamentosParaCompra(c, { lancamentosBanco, lancamentosCartao });
      const best = cands[0];
      if (best && nivelConfianca(best.score) === 'alta') {
        await vincularCompraPagamento({ item_compra_id: c.id, tipo: best.tipo, ref_id: best.ref.id });
        vinculados++;
      }
    }
    setSalvando(false);
    onRefresh?.();
    alert(`✓ ${vinculados} compras vinculadas automaticamente (alta confiança)`);
  }

  return (
    <div>
      {/* Barra de stats */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <div className="bg-card rounded-xl border p-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Total compras</p>
          <p className="text-xl font-bold">{compras.length}</p>
          <p className="text-[10px] text-muted-foreground">{formatCurrency(stats.totalValor)}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3">
          <p className="text-[10px] font-bold uppercase text-emerald-700">Pagas</p>
          <p className="text-xl font-bold text-emerald-700">{stats.pago}</p>
          <p className="text-[10px] text-emerald-600">{formatCurrency(stats.pagoValor)}</p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-3">
          <p className="text-[10px] font-bold uppercase text-orange-700">Parciais</p>
          <p className="text-xl font-bold text-orange-700">{stats.parcial || 0}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
          <p className="text-[10px] font-bold uppercase text-amber-700">Pendentes</p>
          <p className="text-xl font-bold text-amber-700">{stats.pendente || 0}</p>
        </div>
        <div className="bg-slate-50 rounded-xl border p-3">
          <p className="text-[10px] font-bold uppercase text-slate-600">Não identif.</p>
          <p className="text-xl font-bold text-slate-700">{stats.nao_identificado || 0}</p>
        </div>
      </div>

      <div className="flex justify-end mb-3">
        <Button onClick={autoVincularLote} disabled={salvando} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Link2 className="w-4 h-4" /> {salvando ? 'Processando...' : 'Auto-vincular alta confiança'}
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Fornecedor</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Produto</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Forma</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Status</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {compras.map(c => {
                const st = STATUS_CFG[c.status_pagamento || 'nao_identificado'];
                const Icon = st.icon;
                return (
                  <tr key={c.id} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{c.data_emissao}</td>
                    <td className="px-3 py-2 font-semibold truncate max-w-[160px]">{c.fornecedor}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[220px]">{c.descricao_produto}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{formatCurrency(c.valor_total)}</td>
                    <td className="px-3 py-2 text-center">
                      {c.forma_pagamento === 'cartao' && <CreditCard className="w-3.5 h-3.5 text-purple-600 inline" />}
                      {c.forma_pagamento?.startsWith('banco') && <Landmark className="w-3.5 h-3.5 text-blue-600 inline" />}
                      {(!c.forma_pagamento || c.forma_pagamento === 'nao_definida') && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${st.color}`}>
                        <Icon className="w-3 h-3" /> {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.status_pagamento === 'pago' ? (
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => desvincular(c)} disabled={salvando}>
                          <Unlink className="w-3 h-3 mr-1" /> Desvincular
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setCompraAberta(c)}>
                          <Link2 className="w-3 h-3 mr-1" /> Vincular
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {compras.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhuma compra no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!compraAberta} onOpenChange={() => setCompraAberta(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Vincular compra a pagamento</DialogTitle></DialogHeader>
          {compraAberta && (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Compra</p>
                <p className="font-semibold">{compraAberta.fornecedor} · {compraAberta.descricao_produto}</p>
                <p className="text-sm font-bold">{formatCurrency(compraAberta.valor_total)} · {compraAberta.data_emissao}</p>
              </div>
              <p className="text-xs font-bold uppercase text-muted-foreground">Candidatos encontrados</p>
              {candidatos.length === 0 && (
                <p className="text-sm text-muted-foreground italic py-4">Nenhum pagamento compatível encontrado nos últimos 60 dias.</p>
              )}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {candidatos.map((c, i) => {
                  const nivel = nivelConfianca(c.score);
                  const nc = CONF_CFG[nivel];
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 border rounded-lg p-3 hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {c.tipo === 'cartao' ? <CreditCard className="w-3.5 h-3.5 text-purple-600" /> : <Landmark className="w-3.5 h-3.5 text-blue-600" />}
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">{c.tipo}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${nc.color}`}>{nc.label}</span>
                        </div>
                        <p className="font-semibold text-sm truncate">
                          {c.tipo === 'cartao' ? c.ref.estabelecimento : c.ref.descricao}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {c.tipo === 'cartao' ? c.ref.data_lancamento : c.ref.data} · {c.motivo}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{formatCurrency(Math.abs(c.ref.valor || 0))}</p>
                        <Button size="sm" className="mt-1 h-7 text-[11px]" onClick={() => vincular(c.tipo, c.ref.id)} disabled={salvando}>
                          Vincular
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}