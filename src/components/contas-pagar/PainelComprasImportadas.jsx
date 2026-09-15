import { useMemo, useState } from 'react';
import { ShoppingCart, ChevronDown, ChevronUp, CloudDownload } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

const STATUS = [
  { key: 'pendente',         label: 'Pendente',        color: 'text-amber-700',   bg: 'bg-amber-50' },
  { key: 'parcial',          label: 'Parcial',         color: 'text-orange-700',  bg: 'bg-orange-50' },
  { key: 'nao_identificado', label: 'Não identificado',color: 'text-slate-700',   bg: 'bg-slate-50' },
  { key: 'pago',             label: 'Pago',            color: 'text-emerald-700', bg: 'bg-emerald-50' },
];

// Mês de referência do desembolso: vencimento (vindo da Central) com fallback na emissão
function mesDe(c) {
  return (c.data_vencimento || c.data_emissao || '').slice(0, 7) || 'sem-data';
}
function rotuloMes(m) {
  if (m === 'sem-data') return 'Sem data';
  const [y, mm] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}
function valorAberto(c) {
  return c.status_pagamento === 'pago' ? 0 : Math.max(0, (c.valor_total || 0) - (c.valor_pago || 0));
}
function valorDoStatus(c) {
  return c.status_pagamento === 'pago' ? (c.valor_total || 0) : valorAberto(c);
}

/**
 * Painel visual das compras (ItemCompra) agrupadas por status de pagamento × mês de vencimento.
 * Foco nas compras sincronizadas da Central de Compras (pedido_central_id), com opção de ver todas.
 * Somente leitura — não altera nenhuma regra do Contas a Pagar.
 */
export default function PainelComprasImportadas({ compras = [], mesReferencia }) {
  const [aberto, setAberto] = useState(true);
  const [soImportadas, setSoImportadas] = useState(true);
  const [celula, setCelula] = useState(null); // { status, mes }

  const base = useMemo(
    () => compras.filter(c =>
      (soImportadas ? !!c.pedido_central_id : true) &&
      (!mesReferencia || mesDe(c) === mesReferencia)
    ),
    [compras, soImportadas, mesReferencia]
  );

  const { meses, matriz, totaisMes, totaisStatus, total, totalPago } = useMemo(() => {
    const mesesSet = new Set();
    const m = {};
    STATUS.forEach(s => { m[s.key] = {}; });
    base.forEach(c => {
      const st = STATUS.some(s => s.key === c.status_pagamento) ? c.status_pagamento : 'nao_identificado';
      const mes = mesDe(c);
      mesesSet.add(mes);
      m[st][mes] = (m[st][mes] || 0) + valorDoStatus(c);
    });
    const meses = [...mesesSet].sort((a, b) => (a === 'sem-data' ? 1 : b === 'sem-data' ? -1 : a.localeCompare(b)));
    const totaisMes = {};
    meses.forEach(mes => { totaisMes[mes] = STATUS.filter(st => st.key !== 'pago').reduce((s, st) => s + (m[st.key][mes] || 0), 0); });
    const totaisStatus = {};
    STATUS.forEach(st => { totaisStatus[st.key] = meses.reduce((s, mes) => s + (m[st.key][mes] || 0), 0); });
    return {
      meses,
      matriz: m,
      totaisMes,
      totaisStatus,
      total: Object.values(totaisMes).reduce((a, b) => a + b, 0),
      totalPago: totaisStatus.pago || 0,
    };
  }, [base]);

  const itensCelula = useMemo(() => {
    if (!celula) return [];
    return base.filter(c => {
      const st = STATUS.some(s => s.key === c.status_pagamento) ? c.status_pagamento : 'nao_identificado';
      return st === celula.status && mesDe(c) === celula.mes;
    }).sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''));
  }, [base, celula]);

  return (
    <div className="bg-card border rounded-xl mb-4 overflow-hidden">
      <button onClick={() => setAberto(!aberto)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" /> Detalhamento das compras no período
          </h3>
          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            Em aberto · {formatCurrency(total)}
          </span>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
            Pago · {formatCurrency(totalPago)}
          </span>
        </div>
        {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-2 text-[11px]">
            <button onClick={() => { setSoImportadas(true); setCelula(null); }}
              className={`px-2.5 py-1 rounded-full border font-semibold inline-flex items-center gap-1 ${soImportadas ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}>
              <CloudDownload className="w-3 h-3" /> Só importadas da Central
            </button>
            <button onClick={() => { setSoImportadas(false); setCelula(null); }}
              className={`px-2.5 py-1 rounded-full border font-semibold ${!soImportadas ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}>
              Todas as compras
            </button>
          </div>

          {meses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {soImportadas ? 'Nenhuma compra importada da Central neste período.' : 'Nenhuma compra registrada neste período.'}
            </p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                    {meses.map(mes => (
                      <th key={mes} className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap capitalize">{rotuloMes(mes)}</th>
                    ))}
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS.map(st => (
                    <tr key={st.key} className="border-b last:border-b-0">
                      <td className={`px-3 py-2 font-semibold ${st.color}`}>{st.label}</td>
                      {meses.map(mes => {
                        const v = matriz[st.key][mes] || 0;
                        const sel = celula && celula.status === st.key && celula.mes === mes;
                        return (
                          <td key={mes} className="px-1 py-1 text-right">
                            <button
                              disabled={!v}
                              onClick={() => setCelula(sel ? null : { status: st.key, mes })}
                              className={`w-full px-2 py-1 rounded tabular-nums text-right ${v ? `${st.bg} ${st.color} font-semibold hover:ring-1 hover:ring-primary` : 'text-muted-foreground/50'} ${sel ? 'ring-2 ring-primary' : ''}`}>
                              {v ? formatCurrency(v) : '—'}
                            </button>
                          </td>
                        );
                      })}
                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${st.color}`}>{formatCurrency(totaisStatus[st.key])}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30">
                    <td className="px-3 py-2 font-bold">Em aberto no período</td>
                    {meses.map(mes => (
                      <td key={mes} className="px-3 py-2 text-right font-bold tabular-nums">{formatCurrency(totaisMes[mes])}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{formatCurrency(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {celula && itensCelula.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-1.5 bg-muted/40 text-[11px] font-bold flex items-center justify-between">
                <span>{STATUS.find(s => s.key === celula.status)?.label} · {rotuloMes(celula.mes)} · {itensCelula.length} item(ns)</span>
                <button onClick={() => setCelula(null)} className="opacity-70 hover:opacity-100">×</button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {itensCelula.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.descricao_produto}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {c.fornecedor} · venc. {c.data_vencimento ? formatDate(c.data_vencimento) : 'emissão ' + formatDate(c.data_emissao)}
                        {c.pedido_central_id ? ` · ${c.pedido_central_id}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${c.status_pagamento === 'pago' ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(valorDoStatus(c))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}