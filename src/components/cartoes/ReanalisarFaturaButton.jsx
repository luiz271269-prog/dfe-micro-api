import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScanSearch, Loader2, AlertTriangle } from 'lucide-react';
import { reanalisarFatura } from '@/functions/reanalisarFatura';
import { formatCurrency } from '@/lib/formatters';
import ReanaliseFaturaResultado from './ReanaliseFaturaResultado';

export default function ReanalisarFaturaButton({ faturaId, titulo }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true); setError(null); setData(null);
    try {
      const r = await reanalisarFatura({ fatura_id: faturaId });
      setData(r?.data || r);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erro desconhecido');
    }
    setLoading(false);
  }

  function handleOpen(v) {
    setOpen(v);
    if (v) run(); else { setData(null); setError(null); }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleOpen(true); }}
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
        title="Reanalisar esta fatura no backend">
        <ScanSearch className="w-3 h-3" /> Reanalisar
      </button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Reanálise forense · {titulo}</DialogTitle>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {loading && (
            <div className="py-10 flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando lançamentos, órfãos e vínculos...</p>
            </div>
          )}

          {data && <ReanaliseFaturaResultado data={data} formatCurrency={formatCurrency} />}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={run} disabled={loading}>Reexecutar</Button>
            <Button size="sm" onClick={() => handleOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}