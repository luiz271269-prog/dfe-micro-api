import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Play, Loader2, FileText, ExternalLink } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import PastaMonitoradaCard from '@/components/drive/PastaMonitoradaCard';
import AdicionarPastaCard from '@/components/drive/AdicionarPastaCard';
import { varreduraDiariaDrive } from '@/functions/varreduraDiariaDrive';
import { formatDate } from '@/lib/formatters';

export default function PastasMonitoradas() {
  const [configs, setConfigs] = useState([]);
  const [comprovantes, setComprovantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function load() {
    setLoading(true);
    const [cfgs, inbox] = await Promise.all([
      base44.entities.ConfigDrivePastaXML.list(),
      base44.entities.ComprovanteInbox.filter({ status: 'novo' }, '-modificado_em', 50),
    ]);
    setConfigs(cfgs || []);
    setComprovantes(inbox || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const tiposUsados = configs.map(c => c.tipo_pasta);

  async function rodarAgora() {
    setRodando(true);
    setResultado(null);
    try {
      const res = await varreduraDiariaDrive({});
      const data = res?.data || res;
      setResultado(data);
      await load();
    } catch (e) {
      setResultado({ error: e.message });
    }
    setRodando(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <PageHeader title="Pastas Monitoradas" subtitle="Vincule as pastas uma vez. A automação varre todo dia às 10h e importa só o que é novo.">
        <Button onClick={rodarAgora} disabled={rodando} className="gap-2">
          {rodando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Varrer agora
        </Button>
      </PageHeader>

      {resultado && (
        <div className={`rounded-xl p-4 mb-6 text-sm ${resultado.error ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
          {resultado.error ? (
            <p>Erro: {resultado.error}</p>
          ) : (
            <div className="space-y-1">
              {(resultado.resultados || []).map((r, i) => (
                <p key={i}>
                  📂 <span className="font-semibold">{r.folder_name || r.tipo}</span>: {r.erro ? `erro — ${r.erro}` : `${r.novos} novos · ${r.ok} processados${r.erros ? ` · ${r.erros} erros` : ''}`}
                </p>
              ))}
              {(!resultado.resultados || resultado.resultados.length === 0) && <p>{resultado.mensagem || 'Nada para processar.'}</p>}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {configs.map(cfg => (
          <PastaMonitoradaCard key={cfg.id} config={cfg} onChange={load} />
        ))}
        <AdicionarPastaCard tiposUsados={tiposUsados} onChange={load} />
      </div>

      <div>
        <h2 className="text-lg font-bold text-foreground mb-3">Comprovantes novos no inbox ({comprovantes.length})</h2>
        {comprovantes.length === 0 ? (
          <div className="bg-muted/40 border rounded-xl p-8 text-center text-sm text-muted-foreground">
            Nenhum comprovante novo. Os arquivos importados da pasta de comprovantes aparecem aqui.
          </div>
        ) : (
          <div className="space-y-2">
            {comprovantes.map(c => (
              <a
                key={c.id}
                href={c.drive_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-card border rounded-xl p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{c.nome_arquivo}</p>
                  <p className="text-[11px] text-muted-foreground">{c.modificado_em ? formatDate(c.modificado_em.slice(0, 10)) : ''}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}