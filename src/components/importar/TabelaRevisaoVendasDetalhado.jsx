import { formatCurrency } from '../../lib/formatters';
import StatusBadge from './StatusBadgeRevisao';

/**
 * Agrupa NFs/CIs com suas parcelas em uma linha só.
 * - Cada NF/CI vira 1 linha.
 * - Parcelas aparecem em colunas P1, P2, P3, P4 (com venc + valor + pago).
 */
export default function TabelaRevisaoVendasDetalhado({ records, setRecords }) {
  const notas = records.filter(r => r.data.__type === 'NotaFiscal');
  const cobs = records.filter(r => r.data.__type === 'TituloCobranca');

  // Agrupar cobranças por seu_numero (NF-XXX ou CI-XXXXXX)
  const cobsByKey = {};
  cobs.forEach((c, idx) => {
    const key = (c.data.seu_numero || '').trim();
    if (!key) return;
    if (!cobsByKey[key]) cobsByKey[key] = [];
    cobsByKey[key].push({ ...c, _origIdx: records.indexOf(c) });
  });
  // Ordenar parcelas pelo parcela_numero
  Object.values(cobsByKey).forEach(arr => arr.sort((a, b) => (a.data.parcela_numero || 0) - (b.data.parcela_numero || 0)));

  // Máximo de parcelas em qualquer NF/CI (para definir nº de colunas)
  const maxParcelas = Math.max(1, ...Object.values(cobsByKey).map(arr => arr.length));

  // Linhas agrupadas: cada NF + suas parcelas
  const linhas = notas.map((nfRec) => {
    const origIdx = records.indexOf(nfRec);
    const nf = nfRec.data;
    const chave = `${nf.tipo}-${nf.numero}`;
    const parcelas = cobsByKey[chave] || [];
    return { nfRec, origIdx, parcelas };
  });

  // Cobranças órfãs (sem NF correspondente — não deveria existir, mas exibimos por segurança)
  const chavesUsadas = new Set(notas.map(n => `${n.data.tipo}-${n.data.numero}`));
  const orfaos = Object.entries(cobsByKey).filter(([k]) => !chavesUsadas.has(k));

  const togglePai = (origIdx, parcelas, value) => {
    setRecords(r => r.map((x, j) => {
      if (j === origIdx) return { ...x, selected: value };
      if (parcelas.some(p => p._origIdx === j)) return { ...x, selected: value };
      return x;
    }));
  };

  const toggleParcela = (parcelaOrigIdx, value) => {
    setRecords(r => r.map((x, j) => j === parcelaOrigIdx ? { ...x, selected: value } : x));
  };

  const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-2 py-2 w-8">
                <input type="checkbox" checked={records.every(r => r.selected)}
                  onChange={e => setRecords(r => r.map(rec => ({ ...rec, selected: e.target.checked })))} />
              </th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-16">Status</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Nº / Tipo</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Emissão</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Cliente</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Vendedor</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Total</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Recebido</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Aberto</th>
              <th className="px-2 py-2 text-center font-semibold text-muted-foreground">Status NF</th>
              {Array.from({ length: maxParcelas }).map((_, i) => (
                <th key={i} className="px-2 py-2 text-center font-semibold text-blue-700 border-l bg-blue-50/40 min-w-[140px]">
                  Parcela {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ nfRec, origIdx, parcelas }) => {
              const nf = nfRec.data;
              const allSelected = nfRec.selected && parcelas.every(p => p.selected);
              return (
                <tr key={origIdx} className={`border-b transition-colors ${allSelected ? 'bg-card' : 'bg-muted/10 opacity-70'} hover:bg-muted/30`}>
                  <td className="px-2 py-2 align-top">
                    <input type="checkbox" checked={allSelected}
                      onChange={e => togglePai(origIdx, parcelas, e.target.checked)} />
                  </td>
                  <td className="px-2 py-2 align-top"><StatusBadge status={nfRec.status} /></td>
                  <td className="px-2 py-2 align-top font-semibold whitespace-nowrap">
                    <span className={nf.tipo === 'CI' ? 'text-purple-700' : 'text-blue-700'}>{nf.tipo}-{nf.numero}</span>
                  </td>
                  <td className="px-2 py-2 align-top whitespace-nowrap text-muted-foreground">{fmtDate(nf.data_emissao)}</td>
                  <td className="px-2 py-2 align-top max-w-[200px] truncate" title={nf.cliente}>{nf.cliente || '—'}</td>
                  <td className="px-2 py-2 align-top whitespace-nowrap">{nf.vendedor || '—'}</td>
                  <td className="px-2 py-2 align-top text-right font-semibold tabular-nums">{formatCurrency(nf.valor_total || 0)}</td>
                  <td className="px-2 py-2 align-top text-right tabular-nums text-green-700">{formatCurrency(nf.valor_recebido || 0)}</td>
                  <td className="px-2 py-2 align-top text-right tabular-nums text-amber-700">{formatCurrency(nf.valor_aberto || 0)}</td>
                  <td className="px-2 py-2 align-top text-center"><StatusBadge status={nf.status} /></td>
                  {Array.from({ length: maxParcelas }).map((_, i) => {
                    const p = parcelas[i];
                    if (!p) return <td key={i} className="px-2 py-2 align-top border-l bg-blue-50/10 text-center text-muted-foreground/40">—</td>;
                    const isPaga = p.data.status === 'pago';
                    return (
                      <td key={i} className={`px-2 py-2 align-top border-l ${isPaga ? 'bg-green-50/50' : 'bg-blue-50/20'}`}>
                        <div className="flex items-start gap-1.5">
                          <input type="checkbox" checked={p.selected}
                            onChange={e => toggleParcela(p._origIdx, e.target.checked)}
                            className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="font-semibold">{p.data.nosso_numero || '—'}</span>
                              <StatusBadge status={p.status} />
                            </div>
                            <div className="text-[10px] text-muted-foreground">Venc: {fmtDate(p.data.data_vencimento)}</div>
                            <div className="text-[10px] tabular-nums font-medium">{formatCurrency(p.data.valor_titulo || 0)}</div>
                            {isPaga && (
                              <div className="text-[10px] tabular-nums text-green-700">
                                ✓ {fmtDate(p.data.data_pagamento)} · {formatCurrency(p.data.valor_pago || 0)}
                              </div>
                            )}
                            <div className={`text-[9px] mt-0.5 px-1 py-0.5 rounded inline-block ${
                              p.data.canal_cobranca === 'sicredi' ? 'bg-green-100 text-green-700' :
                              p.data.canal_cobranca === 'carteira' ? 'bg-amber-100 text-amber-700' :
                              p.data.canal_cobranca === 'magalu' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>{p.data.canal_cobranca || '—'}</div>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {orfaos.length > 0 && (
              <tr className="border-b bg-red-50">
                <td colSpan={10 + maxParcelas} className="px-2 py-2 text-[11px] text-red-700 font-semibold">
                  ⚠️ {orfaos.length} grupos de parcelas sem NF/CI correspondente — verifique
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}