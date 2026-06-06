import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';
import { sincronizarNFeAN } from '@/functions/sincronizarNFeAN';

export default function SincronizarButton({ empresa = 'NeuralTec', onDone }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function rodar() {
    setBusy(true); setResult(null);
    try {
      const res = await sincronizarNFeAN({ empresa });
      const data = res?.data || res;
      setResult(data);
      if (onDone) await onDone();
    } catch (e) {
      setResult({ ok: false, motivo: e?.response?.data?.motivo || e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <Button onClick={rodar} disabled={busy} className="gap-2">
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...</>
              : <><RefreshCw className="w-4 h-4" /> Sincronizar {empresa}</>}
      </Button>

      {result && (
        <div className={`absolute top-full mt-2 right-0 w-96 rounded-xl border p-3 shadow-lg z-50 ${
          result.ok ? 'bg-emerald-50 border-emerald-200'
            : result.plano_b_necessario || result.bloqueado ? 'bg-amber-50 border-amber-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-2">
            {result.ok ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              : result.bloqueado ? <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
            <div className="flex-1 text-xs">
              {result.ok ? (
                <>
                  <p className="font-bold text-emerald-800">✓ Sync concluído</p>
                  <p className="text-emerald-900 mt-1">
                    <strong>{result.novos}</strong> novos · {result.duplicados} duplicados · {result.erros} erros
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {result.loops} batch(es) · cStat {result.cstat} · NSU {result.nsu_final}/{result.max_nsu || '?'}
                  </p>
                  {result.x_motivo && <p className="text-[10px] text-muted-foreground mt-0.5">{result.x_motivo}</p>}
                </>
              ) : result.plano_b_necessario ? (
                <>
                  <p className="font-bold text-amber-800">⚠ Plano B necessário</p>
                  <p className="text-amber-900 mt-1">{result.motivo}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Será preciso uma micro-API externa (Node) para fazer o mTLS. Avise quando for hora.
                  </p>
                </>
              ) : result.bloqueado ? (
                <>
                  <p className="font-bold text-amber-800">⏱ Bloqueado</p>
                  <p className="text-amber-900 mt-1">{result.motivo}</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-red-800">✗ Erro</p>
                  <p className="text-red-900 mt-1">{result.motivo}</p>
                </>
              )}
            </div>
            <button onClick={() => setResult(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}