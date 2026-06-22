import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import GoogleDrivePicker from '../components/nfe/GoogleDrivePicker';
import ResultadoAnaliseNFe from '../components/nfe/ResultadoAnaliseNFe';
import RelatorioConformidade from '../components/nfe/RelatorioConformidade';
import VarreduraAutomaticaXML from '../components/nfe/VarreduraAutomaticaXML';
import { analisarXMLNFe } from '@/functions/analisarXMLNFe';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, FileSearch, Shield, BarChart3 } from 'lucide-react';

const CONNECTOR_ID = '69e4cc139c63e916cf87b922'; // Drive "Financeiro"

export default function AnaliseNFe() {
  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [analises, setAnalises] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [ultimoResumo, setUltimoResumo] = useState(null);

  async function loadAnalises() {
    const list = await base44.entities.NFeAnalise.list('-created_date', 200);
    setAnalises(Array.isArray(list) ? list : []);
  }

  useEffect(() => {
    (async () => {
      const authed = await base44.auth.isAuthenticated();
      if (authed) {
        const me = await base44.auth.me();
        setUser(me);
        try {
          await base44.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
          setConnected(true);
          await loadAnalises();
        } catch {
          setConnected(false);
        }
      }
      setLoadingAuth(false);
    })();
  }, []);

  async function handleConnect() {
    const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
    const popup = window.open(url, '_blank');
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        (async () => {
          try {
            await base44.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
            setConnected(true);
            await loadAnalises();
          } catch { setConnected(false); }
        })();
      }
    }, 500);
  }

  async function handleFilesSelected(fileIds) {
    setProcessando(true);
    setUltimoResumo(null);
    try {
      const res = await analisarXMLNFe({ file_ids: fileIds });
      setUltimoResumo(res?.data || null);
      await loadAnalises();
    } catch (e) {
      alert('Erro ao processar: ' + e.message);
    }
    setProcessando(false);
  }

  if (loadingAuth) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  if (!user) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <p className="mb-4">Você precisa estar logado para usar esta função.</p>
        <Button onClick={() => base44.auth.redirectToLogin()}>Entrar</Button>
      </div>
    );
  }

  const stats = {
    total: analises.length,
    matches: analises.filter(a => a.status_comparacao === 'match_exato').length,
    divergencias: analises.filter(a => a.status_comparacao?.startsWith('divergencia')).length,
    semPedido: analises.filter(a => a.status_comparacao === 'sem_pedido').length,
    scoreMedio: analises.length > 0 ? Math.round(analises.reduce((s, a) => s + (a.score_conformidade || 0), 0) / analises.length) : 0,
    divergenciasFiscais: analises.reduce((s, a) => s + (a.divergencias_fiscais?.length || 0), 0),
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Análise de XMLs de NF-e"
        subtitle="Leia XMLs do Drive (Financeiro), extraia produtos + impostos e compare com pedidos de compra"
      >
        {connected && (
          <>
            <GoogleDrivePicker onFilesSelected={handleFilesSelected} />
            <Button variant="outline" onClick={loadAnalises} className="gap-2"><RefreshCw className="w-4 h-4" /> Atualizar</Button>
          </>
        )}
      </PageHeader>

      {!connected ? (
        <div className="bg-card border rounded-xl p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-bold mb-2">Conecte sua conta do Google Drive (Financeiro)</p>
          <p className="text-sm text-muted-foreground mb-4">
            Será solicitada permissão para você <strong>selecionar</strong> os arquivos XML da pasta Financeiro via Google Picker.
            Por política do Google, o app só acessa arquivos que você explicitamente selecionar.
          </p>
          <Button onClick={handleConnect} className="bg-blue-600 hover:bg-blue-700">Conectar Google Drive</Button>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-bold uppercase text-muted-foreground">Total</p><FileText className="w-4 h-4 opacity-60" /></div>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
              <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-bold uppercase text-emerald-700">Match exato</p><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
              <p className="text-xl font-bold text-emerald-700">{stats.matches}</p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-bold uppercase text-amber-700">Divergência</p><AlertTriangle className="w-4 h-4 text-amber-600" /></div>
              <p className="text-xl font-bold text-amber-700">{stats.divergencias}</p>
            </div>
            <div className="bg-rose-50 rounded-xl border border-rose-200 p-4">
              <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-bold uppercase text-rose-700">Sem pedido</p><XCircle className="w-4 h-4 text-rose-600" /></div>
              <p className="text-xl font-bold text-rose-700">{stats.semPedido}</p>
            </div>
            <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
              <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-bold uppercase text-indigo-700">Score médio</p><Shield className="w-4 h-4 text-indigo-600" /></div>
              <p className={`text-xl font-bold ${stats.scoreMedio >= 85 ? 'text-emerald-700' : stats.scoreMedio >= 65 ? 'text-amber-700' : 'text-rose-700'}`}>{stats.scoreMedio}<span className="text-xs text-muted-foreground">/100</span></p>
            </div>
            <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
              <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-bold uppercase text-purple-700">Div. fiscais</p><AlertTriangle className="w-4 h-4 text-purple-600" /></div>
              <p className="text-xl font-bold text-purple-700">{stats.divergenciasFiscais}</p>
            </div>
          </div>

          {/* Super-agente: varredura automática em loop */}
          <VarreduraAutomaticaXML onConcluido={loadAnalises} />

          {/* Processando */}
          {processando && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <p className="text-sm font-semibold text-blue-900">Processando XMLs... baixando do Drive, extraindo produtos e comparando com pedidos.</p>
            </div>
          )}

          {/* Último resumo */}
          {ultimoResumo && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-sm">
              <p className="font-bold text-emerald-900">✓ {ultimoResumo.processados} arquivo(s) processado(s)</p>
              <ul className="text-xs text-emerald-800 mt-1 space-y-0.5">
                {(ultimoResumo.resultados || []).map((r, i) => (
                  <li key={i}>
                    • {r.drive_file_name || r.file_id}: {r.error ? <span className="text-rose-700">{r.error}</span> : <>{r.status} ({r.divergencias} divergência{r.divergencias !== 1 ? 's' : ''})</>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resultados com abas */}
          {analises.length > 0 ? (
            <Tabs defaultValue="lista" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="lista" className="gap-2"><FileText className="w-4 h-4" /> NF-e analisadas</TabsTrigger>
                <TabsTrigger value="relatorio" className="gap-2"><BarChart3 className="w-4 h-4" /> Relatório de Conformidade Fiscal</TabsTrigger>
              </TabsList>
              <TabsContent value="lista">
                <ResultadoAnaliseNFe analises={analises} />
              </TabsContent>
              <TabsContent value="relatorio">
                <RelatorioConformidade analises={analises} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="bg-card border rounded-xl p-8 text-center">
              <FileSearch className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold mb-1">Nenhuma NF-e analisada ainda</p>
              <p className="text-xs text-muted-foreground">Clique em "Selecionar XMLs no Drive" para começar.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}