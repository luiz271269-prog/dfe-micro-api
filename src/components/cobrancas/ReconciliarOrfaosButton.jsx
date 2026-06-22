import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Link2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { reconciliarTitulosNFLegado } from '@/functions/reconciliarTitulosNFLegado';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function ReconciliarOrfaosButton({ onComplete }) {
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
      const res = await reconciliarTitulosNFLegado({ dry_run: true });
      setPreview(res?.data || res);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Erro desconhecido');
    }
    setLoading(false);
  }

  async function apply() {
    if (!preview || preview.total_para_vincular === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reconciliarTitulosNFLegado({ dry_run: false });
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
        <Link2 className="w-3.5 h-3.5" /> Reconciliar órfãos
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reconciliar Títulos Órfãos com Notas Fiscais</DialogTitle>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {loading && !preview && !applied && (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando órfãos e procurando NFs...</p>
            </div>
          )}

          {preview && !applied && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Órfãos</p>
                  <p className="font-bold text-lg">{preview.total_orfaos}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-emerald-600">Match exato</p>
                  <p className="font-bold text-lg text-emerald-700">{preview.match_exato}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600">Match fuzzy</p>
                  <p className="font-bold text-lg text-blue-700">{preview.match_fuzzy}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-600">Sem match</p>
                  <p className="font-bold text-lg text-amber-700">{preview.sem_match}</p>
                </div>
              </div>

              {preview.total_para_vincular === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm text-emerald-800">Nenhum órfão vinculável encontrado.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {preview.total_para_vincular} título(s) órfão(s) serão vinculados à NF correspondente. Match exato (confiança 100%) usa NF-XXX/CI-XXXXXX no campo. Match fuzzy cruza cliente + valor com parcelas.
                  </p>
                  <div className="space-y-2 max-h-80 overflow-y-auto border rounded-lg p-2">
                    {preview.matches.slice(0, 50).map((m, i) => (
                      <div key={i} className="bg-muted/20 rounded p-2 text-xs space-y-0.5">
                        <p className="font-semibold text-foreground/90">
                          {(m.titulo.cliente || '').slice(0, 50)} · {formatDate(m.titulo.data_vencimento)} · {formatCurrency(m.titulo.valor_titulo)}
                        </p>
                        <p className="text-muted-foreground">
                          Título: <span className="font-mono">{m.titulo.nosso_numero}</span>
                          {m.titulo.seu_numero && <> · {m.titulo.seu_numero}</>}
                        </p>
                        <p className="text-emerald-700">
                          → Vincular a {m.nf.tipo}-{m.nf.numero} · {formatCurrency(m.nf.valor_total)}
                          <span className="ml-2 text-muted-foreground">({m.metodo} · {m.confianca}%)</span>
                        </p>
                      </div>
                    ))}
                    {preview.matches.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">... e mais {preview.matches.length - 50} matches</p>
                    )}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">Vincula o campo <code className="font-mono">nota_fiscal_id</code> nos títulos. Reversível campo-a-campo, mas em lote convém revisar a prévia.</p>
                  </div>
                </>
              )}
            </div>
          )}

          {applied && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">Reconciliação concluída!</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/30 rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">Vinculados</p>
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
            {preview && !applied && preview.total_para_vincular > 0 && (
              <Button onClick={apply} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Vincular {preview.total_para_vincular} título(s)
              </Button>
            )}
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}