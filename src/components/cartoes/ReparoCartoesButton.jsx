import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Wrench, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { repararFaturasDivergentes } from '@/functions/repararFaturasDivergentes';
import { diagnosticarOrfaosCartao } from '@/functions/diagnosticarOrfaosCartao';
import { formatCurrency } from '@/lib/formatters';

export default function ReparoCartoesButton({ onComplete }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reparoData, setReparoData] = useState(null);
  const [orfaosData, setOrfaosData] = useState(null);
  const [appliedR, setAppliedR] = useState(null);
  const [appliedO, setAppliedO] = useState(null);
  const [error, setError] = useState(null);

  async function dryRun() {
    setLoading(true); setError(null);
    setReparoData(null); setOrfaosData(null);
    setAppliedR(null); setAppliedO(null);
    try {
      const [r, o] = await Promise.all([
        repararFaturasDivergentes({ dry_run: true }),
        diagnosticarOrfaosCartao({ dry_run: true }),
      ]);
      setReparoData(r?.data || r);
      setOrfaosData(o?.data || o);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erro desconhecido');
    }
    setLoading(false);
  }

  async function aplicarReparo() {
    setLoading(true); setError(null);
    try {
      const r = await repararFaturasDivergentes({ dry_run: false });
      setAppliedR(r?.data || r);
      if (onComplete) onComplete();
    } catch (e) { setError(e?.response?.data?.error || e?.message); }
    setLoading(false);
  }

  async function aplicarOrfaos() {
    setLoading(true); setError(null);
    try {
      const o = await diagnosticarOrfaosCartao({ dry_run: false, acao: 'reassociar' });
      setAppliedO(o?.data || o);
      if (onComplete) onComplete();
    } catch (e) { setError(e?.response?.data?.error || e?.message); }
    setLoading(false);
  }

  function handleOpen(v) {
    setOpen(v);
    if (v) dryRun();
    else { setReparoData(null); setOrfaosData(null); setAppliedR(null); setAppliedO(null); setError(null); }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpen(true)} className="gap-2">
        <Wrench className="w-3.5 h-3.5" /> Reparo Forense
      </Button>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reparo Forense de Cartões</DialogTitle>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {loading && !reparoData && (
            <div className="py-10 flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Diagnosticando...</p>
            </div>
          )}

          {reparoData && (
            <div className="space-y-3 border rounded-lg p-3 bg-amber-50/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-amber-800">🔴 Faturas com valor_total divergente</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {reparoData.para_reparar} fatura(s) onde soma dos lançamentos ≠ valor_total. A soma é a verdade fiscal (PDF original).
                  </p>
                </div>
                {!appliedR && reparoData.para_reparar > 0 && (
                  <Button size="sm" onClick={aplicarReparo} disabled={loading}>
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Reparar'}
                  </Button>
                )}
                {appliedR && (
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                    <CheckCircle className="w-4 h-4" /> {appliedR.atualizados} reparado(s)
                  </div>
                )}
              </div>
              {reparoData.reparos?.length > 0 && !appliedR && (
                <div className="max-h-48 overflow-y-auto bg-white/80 rounded border text-xs">
                  <table className="w-full">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Mês</th>
                        <th className="px-2 py-1 text-right">Atual</th>
                        <th className="px-2 py-1 text-right">Real (soma)</th>
                        <th className="px-2 py-1 text-right">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reparoData.reparos.slice(0, 30).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{r.mes}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(r.valor_total_atual)}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-emerald-700 font-semibold">{formatCurrency(r.soma_real)}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-red-700">{formatCurrency(r.diff)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {orfaosData && (
            <div className="space-y-3 border rounded-lg p-3 bg-blue-50/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-blue-800">🟠 Lançamentos órfãos (sem fatura)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {orfaosData.total_orfaos} órfão(s) · <span className="text-emerald-700 font-semibold">{orfaosData.reassociaveis} reassociáveis</span> · {orfaosData.ambiguos} ambíguos
                  </p>
                </div>
                {!appliedO && orfaosData.reassociaveis > 0 && (
                  <Button size="sm" onClick={aplicarOrfaos} disabled={loading}>
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Reassociar'}
                  </Button>
                )}
                {appliedO && (
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                    <CheckCircle className="w-4 h-4" /> {appliedO.acoes} reassociado(s)
                  </div>
                )}
              </div>
              {orfaosData.reassociaveis > 0 && !appliedO && (
                <p className="text-[11px] text-muted-foreground italic">
                  Reassociação infere mes_referencia do data_lancamento e vincula à única fatura candidata. Ambíguos (múltiplas faturas no mês ou nenhuma) são preservados.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}