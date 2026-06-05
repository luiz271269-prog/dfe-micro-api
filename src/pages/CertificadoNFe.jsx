import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import UploadCertificadoForm from '../components/certificado/UploadCertificadoForm';
import { Button } from '@/components/ui/button';
import { ShieldCheck, AlertTriangle, RefreshCw, Zap, Trash2 } from 'lucide-react';
import { formatDate } from '../lib/formatters';
import { validarCertificadoNFe } from '@/functions/validarCertificadoNFe';
import { pocConexaoSefazAN } from '@/functions/pocConexaoSefazAN';

const statusColors = {
  valido: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pendente: 'bg-amber-100 text-amber-700 border-amber-200',
  invalido: 'bg-red-100 text-red-700 border-red-200',
  expirado: 'bg-red-100 text-red-700 border-red-200',
  erro: 'bg-red-100 text-red-700 border-red-200',
};

const logStatusColors = {
  ok: 'bg-emerald-100 text-emerald-700',
  poc: 'bg-blue-100 text-blue-700',
  sem_novos: 'bg-slate-100 text-slate-600',
  erro: 'bg-red-100 text-red-700',
  bloqueado_consumo: 'bg-amber-100 text-amber-700',
};

export default function CertificadoNFe() {
  const [certificados, setCertificados] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pocResult, setPocResult] = useState(null);
  const [toast, setToast] = useState(null);

  async function loadData() {
    const [certs, logsList] = await Promise.all([
      base44.entities.CertificadoDigitalNFe.list('-created_date', 20),
      base44.entities.LogSyncSEFAZ.list('-data_execucao', 30),
    ]);
    setCertificados(certs);
    setLogs(logsList);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  async function handleValidar(id) {
    setBusy(`validar-${id}`);
    try {
      const res = await validarCertificadoNFe({ certificado_id: id });
      const data = res.data || res;
      showToast(data.ok ? (data.mensagem || 'Certificado validado') : (data.error || data.mensagem || 'Erro'), data.ok ? 'success' : 'error');
      await loadData();
    } catch (e) {
      showToast(e.message, 'error');
    }
    setBusy(null);
  }

  async function handlePOC(id) {
    setBusy(`poc-${id}`);
    setPocResult(null);
    try {
      const res = await pocConexaoSefazAN({ certificado_id: id });
      const data = res.data || res;
      setPocResult(data);
      await loadData();
    } catch (e) {
      setPocResult({ ok: false, error: e.message });
    }
    setBusy(null);
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este certificado? O arquivo .pfx no storage privado também será desreferenciado.')) return;
    setBusy(`del-${id}`);
    try {
      await base44.entities.CertificadoDigitalNFe.delete(id);
      await loadData();
    } catch (e) {
      showToast(e.message, 'error');
    }
    setBusy(null);
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Certificado Digital NF-e"
        subtitle="Integração com SEFAZ — Ambiente Nacional (NFeDistribuicaoDFe)"
      >
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <ShieldCheck className="w-4 h-4" /> Novo Certificado
        </Button>
      </PageHeader>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 max-w-md ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {showForm && (
        <UploadCertificadoForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData(); showToast('Certificado salvo. Clique em "Validar" para conferir.'); }}
        />
      )}

      {/* Aviso sobre o secret */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-800">
          <p className="font-bold">⚠️ Pré-requisito — Secret da senha do .pfx</p>
          <p className="mt-1">
            Antes de validar o certificado, configure no painel do Base44 (Dashboard → Settings → Secrets) a entrada
            <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded font-mono text-[11px]">CERT_PFX_NEURALTEC</code>
            com a senha do .pfx da NeuralTec. A senha não fica no banco — só este nome.
          </p>
        </div>
      </div>

      {/* Lista de certificados */}
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Certificados Cadastrados</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {certificados.length === 0 && (
          <p className="col-span-2 text-sm text-muted-foreground text-center py-8 bg-card rounded-xl border">
            Nenhum certificado cadastrado. Clique em "Novo Certificado".
          </p>
        )}
        {certificados.map(c => {
          const isValido = c.status_validacao === 'valido';
          return (
            <div key={c.id} className="bg-card rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-bold text-base">{c.empresa}</p>
                  <p className="text-xs text-muted-foreground font-mono">{c.cnpj}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${statusColors[c.status_validacao] || 'bg-slate-100 text-slate-600'}`}>
                  {c.status_validacao}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <p><span className="text-muted-foreground">Ambiente:</span> <strong>{c.ambiente}</strong></p>
                <p><span className="text-muted-foreground">Tipo:</span> {c.tipo || 'A1'}</p>
                <p><span className="text-muted-foreground">Secret:</span> <code className="font-mono text-[10px] bg-muted/40 px-1 rounded">{c.senha_secret_name}</code></p>
                {c.titular && <p className="truncate"><span className="text-muted-foreground">Titular:</span> {c.titular}</p>}
                {c.validade && <p><span className="text-muted-foreground">Validade:</span> {formatDate(c.validade)}</p>}
                {c.ultimo_erro && <p className="text-red-700 mt-1 text-[11px]">⚠ {c.ultimo_erro}</p>}
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => handleValidar(c.id)} disabled={busy === `validar-${c.id}`} className="gap-1.5 text-xs">
                  {busy === `validar-${c.id}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                  Validar
                </Button>
                <Button size="sm" onClick={() => handlePOC(c.id)} disabled={busy === `poc-${c.id}` || !isValido} className="gap-1.5 text-xs">
                  {busy === `poc-${c.id}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  POC Conexão SEFAZ
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} disabled={busy === `del-${c.id}`} className="gap-1.5 text-xs text-red-600 hover:text-red-700 ml-auto">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resultado da POC */}
      {pocResult && (
        <div className={`mb-8 rounded-xl border p-4 ${pocResult.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <h3 className={`font-bold text-sm ${pocResult.ok ? 'text-emerald-800' : 'text-red-800'} mb-2`}>
            {pocResult.ok ? '✓ Conexão SEFAZ estabelecida (mTLS funcionou)' : '✗ POC retornou erro — analise abaixo'}
          </h3>
          {pocResult.cStat != null && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
              <div className="bg-white/70 rounded p-2"><p className="text-muted-foreground">cStat</p><p className="font-bold text-lg">{pocResult.cStat}</p></div>
              <div className="bg-white/70 rounded p-2"><p className="text-muted-foreground">HTTP</p><p className="font-bold text-lg">{pocResult.http_status}</p></div>
              <div className="bg-white/70 rounded p-2"><p className="text-muted-foreground">ultNSU</p><p className="font-bold font-mono text-[11px]">{pocResult.ultNSU || '—'}</p></div>
              <div className="bg-white/70 rounded p-2"><p className="text-muted-foreground">maxNSU</p><p className="font-bold font-mono text-[11px]">{pocResult.maxNSU || '—'}</p></div>
            </div>
          )}
          <p className="text-xs"><strong>Motivo SEFAZ:</strong> {pocResult.xMotivo || pocResult.error || '—'}</p>
          {pocResult.diagnostico && <p className="text-xs mt-1 font-semibold">{pocResult.diagnostico}</p>}
          {pocResult.endpoint && <p className="text-[10px] text-muted-foreground mt-1 font-mono">{pocResult.endpoint}</p>}
          {pocResult.response_preview && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">Ver resposta XML bruta</summary>
              <pre className="mt-2 bg-white/70 p-2 rounded text-[10px] overflow-x-auto max-h-64 whitespace-pre-wrap">{pocResult.response_preview}</pre>
            </details>
          )}
        </div>
      )}

      {/* Logs */}
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Histórico de Execuções</h2>
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Data/Hora</th>
                <th className="text-left px-3 py-2 font-semibold">Operação</th>
                <th className="text-left px-3 py-2 font-semibold">Empresa</th>
                <th className="text-center px-3 py-2 font-semibold">cStat</th>
                <th className="text-center px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">Mensagem</th>
                <th className="text-right px-3 py-2 font-semibold">Duração</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-6 text-muted-foreground">Sem logs ainda</td></tr>
              ) : logs.map(l => (
                <tr key={l.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-3 py-1.5 text-[10px] text-muted-foreground whitespace-nowrap">
                    {l.data_execucao ? new Date(l.data_execucao).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[10px]">{l.tipo_operacao || '—'}</td>
                  <td className="px-3 py-1.5 font-semibold">{l.empresa}</td>
                  <td className="px-3 py-1.5 text-center font-mono">{l.cstat || '—'}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${logStatusColors[l.status_final] || 'bg-slate-100 text-slate-600'}`}>
                      {l.status_final}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[280px]">{l.mensagem}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{l.duracao_ms != null ? `${l.duracao_ms}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}