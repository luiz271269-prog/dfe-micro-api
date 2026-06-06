import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Upload, ShieldCheck, AlertTriangle, Loader2, Stethoscope } from 'lucide-react';
import { validarCertificadoNFe } from '@/functions/validarCertificadoNFe';
import { diagnosticarUploadPFX } from '@/functions/diagnosticarUploadPFX';

const SECRETS_MAP = {
  NeuralTec: 'CERT_PFX_NEURALTEC',
  Liesch: 'CERT_PFX_LIESCH',
};

const CNPJ_MAP = {
  NeuralTec: '62.982.374/0001-07',
  Liesch: '',
};

const RAZAO_SOCIAL_MAP = {
  NeuralTec: 'NEURALTEC DISTRIBUICAO E TECNOLOGIA LTDA',
  Liesch: '',
};

export default function UploadCertificadoForm({ onSaved }) {
  const [empresa, setEmpresa] = useState('NeuralTec');
  const [cnpj, setCnpj] = useState(CNPJ_MAP.NeuralTec);

  function handleEmpresaChange(v) {
    setEmpresa(v);
    setCnpj(CNPJ_MAP[v] || '');
  }
  const [ambiente, setAmbiente] = useState('producao');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [trace, setTrace] = useState([]);
  const [diagResult, setDiagResult] = useState(null);

  function logStep(label, ok, detail) {
    const entry = { t: new Date().toISOString().slice(11, 23), label, ok, detail };
    console.log('[UploadCertificado]', entry);
    setTrace(prev => [...prev, entry]);
  }

  function isErroInfraBase44(msg) {
    const m = String(msg || '').toLowerCase();
    return m.includes('memory_limit_exceeded')
        || m.includes('clickhouse')
        || m.includes('code: 241')
        || m.includes('code 241')
        || m.includes('db::exception')
        || m.includes('overcommittracker');
  }

  async function uploadArquivo() {
    if (!file) { setError('Selecione o arquivo .pfx'); return null; }
    const safeName = `cert_${empresa}_${Date.now()}.pfx`;
    const safeFile = new File([file], safeName, { type: file.type || 'application/x-pkcs12' });
    logStep('arquivo_selecionado', true, { nome_original: file.name, bytes: file.size, safeName });

    // Retry com backoff curto — cobre falha transitória do storage/ClickHouse
    const MAX_TENTATIVAS = 3;
    let ultimoErro = null;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      try {
        logStep(`upload_privado_iniciou${tentativa > 1 ? `_retry${tentativa}` : ''}`, true);
        const uploadRes = await base44.integrations.Core.UploadPrivateFile({ file: safeFile });
        const file_uri = uploadRes?.file_uri;
        if (!file_uri) {
          logStep('upload_privado_terminou', false, { resposta: uploadRes });
          throw new Error('UploadPrivateFile retornou sem file_uri');
        }
        logStep('upload_privado_terminou', true, { file_uri, tentativas: tentativa });
        return file_uri;
      } catch (upErr) {
        ultimoErro = upErr;
        const rawMsg = upErr?.message || String(upErr);
        logStep('upload_privado_terminou', false, { tentativa, erro: rawMsg.slice(0, 200) });
        if (tentativa < MAX_TENTATIVAS) {
          await new Promise(r => setTimeout(r, 1500 * tentativa));
        }
      }
    }

    // Esgotou retries — classifica o erro
    const rawMsg = ultimoErro?.message || String(ultimoErro);
    if (isErroInfraBase44(rawMsg)) {
      throw new Error(
        '⚠️ Falha temporária no storage da Base44 (ClickHouse / MEMORY_LIMIT_EXCEEDED). ' +
        'O arquivo NÃO chegou ao backend — o certificado ainda não foi validado. ' +
        'Aguarde 2–5 minutos e tente novamente. Se persistir, acione o suporte Base44.'
      );
    }
    throw new Error(`Upload do .pfx falhou após ${MAX_TENTATIVAS} tentativas: ${rawMsg}`);
  }

  async function handleDiagnostico() {
    setError(null); setResultado(null); setDiagResult(null); setTrace([]);
    if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) return setError('CNPJ inválido (precisa de 14 dígitos)');
    setUploading(true);
    try {
      const file_uri = await uploadArquivo();
      if (!file_uri) return;
      setUploading(false);
      setValidando(true);
      logStep('chamando_diagnosticarUploadPFX', true);
      const res = await diagnosticarUploadPFX({ file_uri });
      const data = res?.data || res;
      logStep('diagnostico_resposta', !!data?.ok, data);
      setDiagResult(data);
    } catch (err) {
      setError(err?.response?.data?.motivo || err?.message || String(err));
    } finally {
      setUploading(false);
      setValidando(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setResultado(null); setDiagResult(null); setTrace([]);

    if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) return setError('CNPJ inválido (precisa de 14 dígitos)');

    setUploading(true);
    try {
      const file_uri = await uploadArquivo();
      if (!file_uri) {
        // Guarda extra: nunca chamar validarCertificadoNFe sem file_uri
        logStep('validacao_abortada', false, { motivo: 'sem file_uri — falha no upload, não no PFX' });
        return;
      }
      setUploading(false);
      setValidando(true);

      logStep('chamando_validarCertificadoNFe', true);
      const res = await validarCertificadoNFe({
        empresa,
        cnpj,
        ambiente,
        file_uri,
        senha_secret_name: SECRETS_MAP[empresa],
      });

      const data = res?.data || res;
      logStep('validacao_resposta', !!data?.ok, data);
      setResultado(data);
      if (onSaved) onSaved(data);
    } catch (err) {
      setError(err?.response?.data?.motivo || err?.message || String(err));
    } finally {
      setUploading(false);
      setValidando(false);
    }
  }

  return (
    <div className="bg-card rounded-xl border p-5">
      <h3 className="text-base font-bold mb-1">Cadastrar Certificado A1 (.pfx)</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Upload do .pfx em storage privado + validação contra o CNPJ. A senha NÃO vai aqui — ela precisa estar no secret{' '}
        <code className="bg-muted px-1 rounded text-[10px]">{SECRETS_MAP[empresa]}</code> do Base44.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Empresa</Label>
            <Select value={empresa} onValueChange={handleEmpresaChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NeuralTec">NeuralTec</SelectItem>
                <SelectItem value="Liesch">Liesch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ambiente</Label>
            <Select value={ambiente} onValueChange={setAmbiente}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="producao">Produção</SelectItem>
                <SelectItem value="homologacao">Homologação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>CNPJ da empresa</Label>
          <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          {RAZAO_SOCIAL_MAP[empresa] && (
            <p className="text-[10px] text-muted-foreground mt-1">{RAZAO_SOCIAL_MAP[empresa]}</p>
          )}
        </div>

        <div>
          <Label>Arquivo .pfx ou .p12</Label>
          <Input type="file" accept=".pfx,.p12" onChange={e => setFile(e.target.files?.[0] || null)} />
          {file && <p className="text-xs text-muted-foreground mt-1">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
          🔐 Senha do PFX deve estar configurada como secret <strong>{SECRETS_MAP[empresa]}</strong> no Base44 (Settings → Secrets).
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button type="submit" disabled={uploading || validando} className="gap-2">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Subindo PFX...</>
              : validando ? <><Loader2 className="w-4 h-4 animate-spin" /> Validando...</>
              : <><Upload className="w-4 h-4" /> Validar e Salvar</>}
          </Button>
          <Button type="button" variant="outline" disabled={uploading || validando} onClick={handleDiagnostico} className="gap-2">
            <Stethoscope className="w-4 h-4" /> Só diagnosticar (não abre PFX)
          </Button>
        </div>

        {trace.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] font-mono space-y-0.5">
            <p className="text-xs font-bold text-slate-700 mb-1 font-sans">🔍 Trace do fluxo</p>
            {trace.map((s, i) => (
              <div key={i} className={s.ok === false ? 'text-red-700' : 'text-slate-700'}>
                <span className="text-slate-400">{s.t}</span>{' '}
                {s.ok === false ? '❌' : s.ok === true ? '✅' : '•'} {s.label}
                {s.detail && <span className="text-slate-500"> · {typeof s.detail === 'object' ? JSON.stringify(s.detail).slice(0, 140) : String(s.detail).slice(0, 140)}</span>}
              </div>
            ))}
          </div>
        )}

        {diagResult && (
          <div className={`rounded-lg border p-4 text-xs ${diagResult.ok ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
            <p className="font-bold mb-2">🩺 Diagnóstico do upload</p>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Bytes baixados:</span><br /><span className="font-semibold">{diagResult.diagnostico?.bytes_baixados ?? '—'}</span></div>
              <div><span className="text-muted-foreground">Tamanho:</span><br /><span className="font-semibold">{diagResult.diagnostico?.tamanho_kb ?? '—'}</span></div>
              <div><span className="text-muted-foreground">Primeiro byte:</span><br /><span className="font-semibold">{diagResult.diagnostico?.primeiro_byte ?? '—'}</span></div>
              <div><span className="text-muted-foreground">Parece PFX válido:</span><br /><span className="font-semibold">{diagResult.diagnostico?.parece_pfx_valido ? '✅ Sim' : '❌ Não'}</span></div>
            </div>
            {diagResult.diagnostico?.alerta_tamanho && <p className="mt-2 text-amber-700">⚠️ {diagResult.diagnostico.alerta_tamanho}</p>}
            {diagResult.diagnostico?.alerta_estrutura && <p className="mt-2 text-red-700">⚠️ {diagResult.diagnostico.alerta_estrutura}</p>}
            {diagResult.motivo && <p className="mt-2 text-red-700">Erro: {diagResult.motivo}</p>}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {resultado && (
          <div className={`rounded-lg border p-4 ${resultado.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-2">
              {resultado.ok
                ? <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                : <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />}
              <div className="flex-1 text-xs">
                <p className={`font-bold mb-2 ${resultado.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                  {resultado.mensagem || resultado.motivo || (resultado.ok ? 'Certificado válido' : 'Validação falhou')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {resultado.titular && <div><span className="text-muted-foreground">Titular:</span><br /><span className="font-semibold block truncate">{resultado.titular}</span></div>}
                  {resultado.validade && <div><span className="text-muted-foreground">Validade:</span><br /><span className="font-semibold">{resultado.validade}</span></div>}
                  {resultado.cnpj_extraido && <div><span className="text-muted-foreground">CNPJ no cert:</span><br /><span className="font-semibold">{resultado.cnpj_extraido}</span></div>}
                  {resultado.cnpj_informado && <div><span className="text-muted-foreground">CNPJ informado:</span><br /><span className="font-semibold">{resultado.cnpj_informado}</span></div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}