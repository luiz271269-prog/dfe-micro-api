import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '../../lib/formatters';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Scale } from 'lucide-react';

function fmtMesLong(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${nomes[parseInt(mo)-1]} ${y}`;
}

export default function ConciliacaoRelatorio({ selectedMonth, nfsMes }) {
  const [relatorio, setRelatorio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!selectedMonth) return;
    setLoading(true);
    base44.entities.RelatorioFaturamento.filter({ mes: selectedMonth })
      .then(items => {
        setRelatorio(items?.[0] || null);
        setLoading(false);
      });
  }, [selectedMonth]);

  // Totais das NFs do mês
  const totalNFs   = nfsMes.reduce((s, n) => s + (n.valor_total || 0), 0);
  const nfTiago    = nfsMes.filter(n => n.vendedor === 'Tiago').reduce((s, n) => s + (n.valor_total || 0), 0);
  const nfThais    = nfsMes.filter(n => n.vendedor === 'Thais').reduce((s, n) => s + (n.valor_total || 0), 0);
  const nfDireto   = nfsMes.filter(n => n.vendedor === 'Fat.Direto').reduce((s, n) => s + (n.valor_total || 0), 0);

  const relTotal   = relatorio?.total || 0;
  const diferenca  = totalNFs - relTotal;
  const diffPct    = relTotal > 0 ? Math.abs(diferenca / relTotal) * 100 : 0;
  const ok         = diffPct <= 2;

  const semRelatorio = !loading && !relatorio;

  return (
    <div className="rounded-xl border overflow-hidden mb-6">
      <button
        onClick={() => setAberto(!aberto)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors
          ${ok && relatorio ? 'bg-emerald-50 border-b border-emerald-100 text-emerald-800' :
            semRelatorio ? 'bg-yellow-50 border-b border-yellow-100 text-yellow-800' :
            'bg-orange-50 border-b border-orange-100 text-orange-800'}`}
      >
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4" />
          <span>Conciliação NFs × Relatório de Vendas — {fmtMesLong(selectedMonth)}</span>
          {loading && <span className="text-xs font-normal opacity-60">carregando...</span>}
          {!loading && relatorio && (
            ok
              ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">✓ Conciliado ({diffPct.toFixed(1)}% dif.)</span>
              : <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">⚠ Divergência {diffPct.toFixed(1)}%</span>
          )}
          {semRelatorio && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">⚠ Relatório não importado</span>}
        </div>
        {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {aberto && (
        <div className="p-4 bg-background space-y-4">
          {semRelatorio ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <p className="font-medium">Nenhum Relatório de Vendas importado para {fmtMesLong(selectedMonth)}</p>
              <p className="text-sm mt-1">Importe o relatório em <strong>Importar Documento → Relatório de Vendas/NFs</strong></p>
            </div>
          ) : (
            <>
              {/* Comparativo principal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase">NFs no Sistema</p>
                  <p className="text-2xl font-bold text-blue-800 mt-1">{formatCurrency(totalNFs)}</p>
                  <p className="text-xs text-blue-600 mt-1">{nfsMes.length} notas emitidas</p>
                </div>
                <div className="rounded-xl border bg-purple-50 border-purple-200 p-4">
                  <p className="text-xs font-semibold text-purple-700 uppercase">Relatório ({relatorio?.fonte || 'importado'})</p>
                  <p className="text-2xl font-bold text-purple-800 mt-1">{formatCurrency(relTotal)}</p>
                  <p className="text-xs text-purple-600 mt-1">{relatorio?.mes_nome || selectedMonth}</p>
                </div>
                <div className={`rounded-xl border p-4 ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
                  <p className={`text-xs font-semibold uppercase ${ok ? 'text-emerald-700' : 'text-orange-700'}`}>Diferença</p>
                  <p className={`text-2xl font-bold mt-1 ${ok ? 'text-emerald-800' : 'text-orange-800'}`}>{formatCurrency(diferenca)}</p>
                  <p className={`text-xs mt-1 ${ok ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {diffPct.toFixed(1)}% {ok ? '✓ dentro da tolerância' : '⚠ verificar'}
                  </p>
                </div>
              </div>

              {/* Detalhe por vendedor */}
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Vendedor / Item</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">NFs Sistema</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Relatório</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Tiago (V-01)', nf: nfTiago, rel: relatorio?.saidas || 0 },
                      { label: 'Thais (V-05)', nf: nfThais, rel: relatorio?.servicos || 0 },
                      { label: 'Fat. Direto', nf: nfDireto, rel: relatorio?.outros || 0 },
                    ].map(row => {
                      const dif = row.nf - row.rel;
                      return (
                        <tr key={row.label} className="border-b hover:bg-muted/20">
                          <td className="px-4 py-2 font-medium">{row.label}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(row.nf)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(row.rel)}</td>
                          <td className={`px-4 py-2 text-right tabular-nums font-semibold ${Math.abs(dif) < 1 ? 'text-emerald-600' : dif > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                            {Math.abs(dif) < 1 ? '✓' : formatCurrency(dif)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/30 font-bold">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(totalNFs)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(relTotal)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${ok ? 'text-emerald-600' : 'text-orange-600'}`}>{formatCurrency(diferenca)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {relatorio?.observacoes && (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                  <strong>Obs. relatório:</strong> {relatorio.observacoes}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}