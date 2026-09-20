import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plug, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { pocConexaoSefazAN } from '@/functions/pocConexaoSefazAN';

export default function POCConexaoCard({ certificado }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function rodar() {
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await pocConexaoSefazAN({ certificado_id: certificado.id });
      setResult(res?.data || res);
    } catch (err) {
      setError(err?.response?.data?.motivo || err.message);
    } finally {
      setRunning(false);
    }
  }

  const valido = certificado.status_validacao === 'valido';

  return (
    <div className="bg-muted/20 rounded-xl border p-4 mt-3">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-bold">POC Micro-API + SEFAZ AN</h4>
          <p className="text-[11px] text-muted-foreground">
            Valida autenticação e configuração da micro-API sem consultar ou consumir a janela da SEFAZ.
          </p>
        </div>
        <Button onClick={rodar} disabled={!valido || running} size="sm" className="gap-2 shrink-0">
          {running ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Conectando...</>
            : <><Plug className="w-3.5 h-3.5" /> Rodar POC</>}
        </Button>
      </div>

      {!valido && (
        <div className="bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 p-2">
          Valide o certificado antes (status atual: <strong>{certificado.status_validacao}</strong>).
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 mt-2 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className={`mt-2 rounded-lg border p-3 ${result.ok ? 'bg-emerald-50 border-emerald-200' : result.plano_b_necessario ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-2 mb-3">
            {result.ok ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
            <div className="flex-1">
              <p className="font-bold text-sm">{result.diagnostico || result.motivo || 'Resultado'}</p>
              {result.proximo_passo && <p className="text-[11px] mt-1 text-amber-900">{result.proximo_passo}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="bg-white/70 rounded px-2 py-1"><p className="text-muted-foreground">Micro-API</p><p className="font-bold">{result.micro_api_online ? 'Online' : 'Offline'}</p></div>
            {result.http_status != null && <div className="bg-white/70 rounded px-2 py-1"><p className="text-muted-foreground">HTTP</p><p className="font-bold tabular-nums">{result.http_status}</p></div>}
            {result.latencia_ms != null && <div className="bg-white/70 rounded px-2 py-1"><p className="text-muted-foreground">Latência</p><p className="font-bold tabular-nums">{result.latencia_ms} ms</p></div>}
          </div>
          {result.endpoint && <p className="text-[10px] mt-1 text-muted-foreground truncate">{result.endpoint}</p>}

          {result.resposta_xml_preview && (
            <details className="mt-3">
              <summary className="text-[11px] cursor-pointer text-muted-foreground hover:text-foreground">Ver resposta XML bruta (preview)</summary>
              <pre className="mt-2 text-[10px] bg-slate-900 text-slate-100 p-2 rounded overflow-x-auto max-h-56">{result.resposta_xml_preview}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}