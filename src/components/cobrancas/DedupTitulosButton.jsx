import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { deduplicarTitulosCobranca } from '@/functions/deduplicarTitulosCobranca';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function DedupTitulosButton({ onComplete }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [applied, setApplied] = useState(null);
  const [error, setError] = useState(null);

  async function runDryRun() {
    setLoading(true);
    setError(null);
    setPreview(null);
    setApplied(null);
    try {
      const res = await deduplicarTitulosCobranca({ dry_run: true });
      setPreview(res?.data || res);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Erro desconhecido');
    }
    setLoading(false);
  }

  async function apply() {
    if (!preview || preview.total_para_apagar === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await deduplicarTitulosCobranca({ dry_run: false });
      setApplied(res?.data || res);
      if (onComplete) onComplete();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Erro desconhecido');
    }
    setLoading(false);
  }

  function handleOpenChange(v) {
    setOpen(v);
    if (v) runDryRun();
    else { setPreview(null); setApplied(null); setError(null); }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)} className="gap-2">
        <Trash2 className="w-3.5 h-3.5" /> Limpar duplicatas
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deduplicar Títulos de Cobrança</DialogTitle>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {loading && !preview && !applied && (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando títulos no banco...</p>
            </div>
          )}

          {preview && !applied && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total no banco</p>
                  <p className="font-bold text-lg">{preview.total_titulos}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-red-600">Para apagar</p>
                  <p className="font-bold text-lg text-red-700">{preview.total_para_apagar}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600">Mesclar pagamento</p>
                  <p className="font-bold text-lg text-blue-700">{preview.total_para_mesclar}</p>
                </div>
              </div>

              {preview.total_para_apagar === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm text-emerald-800">Nenhuma duplicata encontrada — banco limpo!</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {preview.grupos_com_duplicatas} grupo(s) com mesmo cliente, valor, número da NFE, parcela e vencimento. O registro mais informativo é mantido e os demais são apagados, preservando os dados de pagamento.
                  </p>
                  <div className="space-y-2 max-h-80 overflow-y-auto border rounded-lg p-2">
                    {preview.grupos.slice(0, 30).map((g, i) => (
                      <div key={i} className="bg-muted/20 rounded p-2 text-xs space-y-0.5">
                        <p className="font-semibold text-foreground/90">
                          {(g.winner.cliente || '').slice(0, 50)} · {formatDate(g.winner.data_vencimento)} · {formatCurrency(g.winner.valor_titulo)}
                          {g.winner.parcela_numero && g.winner.parcela_total && (
                            <span className="text-muted-foreground"> · Parcela {g.winner.parcela_numero}/{g.winner.parcela_total}</span>
                          )}
                        </p>
                        <p className="text-emerald-700">
                          ✓ Mantém: <span className="font-mono">{g.winner.nosso_numero}</span>
                          {g.winner.seu_numero && <span className="text-muted-foreground"> ({g.winner.seu_numero})</span>}
                          <span className="text-muted-foreground"> · {g.winner.status} · score {g.winner.score}</span>
                        </p>
                        {g.losers.map((l, j) => (
                          <p key={j} className="text-red-600">
                            ✗ Apaga: <span className="font-mono">{l.nosso_numero}</span>
                            <span className="text-muted-foreground"> · {l.status} · score {l.score}</span>
                          </p>
                        ))}
                        {g.merge_update && (
                          <p className="text-blue-700">
                            ↺ Mescla pagamento: {formatCurrency(g.merge_update.valor_pago)} em {formatDate(g.merge_update.data_pagamento)}
                          </p>
                        )}
                      </div>
                    ))}
                    {preview.grupos.length > 30 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">... e mais {preview.grupos.length - 30} grupos</p>
                    )}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">Ação irreversível. Confira a prévia antes de confirmar.</p>
                  </div>
                </>
              )}
            </div>
          )}

          {applied && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">Deduplicação concluída!</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-muted/30 rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">Apagados</p>
                  <p className="font-bold text-lg">{applied.apagados}</p>
                </div>
                <div className="bg-muted/30 rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">Mesclados</p>
                  <p className="font-bold text-lg">{applied.atualizados}</p>
                </div>
                <div className="bg-muted/30 rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">Erros</p>
                  <p className="font-bold text-lg">{applied.erros}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {preview && !applied && preview.total_para_apagar > 0 && (
              <Button variant="destructive" onClick={apply} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Confirmar e apagar {preview.total_para_apagar} registro(s)
              </Button>
            )}
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}