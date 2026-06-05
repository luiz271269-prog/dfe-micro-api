import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Upload, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { validarCertificadoNFe } from '@/functions/validarCertificadoNFe';

const SECRETS_MAP = {
  NeuralTec: 'CERT_PFX_NEURALTEC',
  Liesch: 'CERT_PFX_LIESCH',
};

export default function UploadCertificadoForm({ onSaved }) {
  const [empresa, setEmpresa] = useState('NeuralTec');
  const [cnpj, setCnpj] = useState('');
  const [ambiente, setAmbiente] = useState('producao');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setResultado(null);

    if (!file) return setError('Selecione o arquivo .pfx');
    if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) return setError('CNPJ inválido (precisa de 14 dígitos)');

    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setUploading(false);
      setValidando(true);

      const res = await validarCertificadoNFe({
        empresa,
        cnpj,
        ambiente,
        file_uri,
        senha_secret_name: SECRETS_MAP[empresa],
      });

      const data = res?.data || res;
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
            <Select value={empresa} onValueChange={setEmpresa}>
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
        </div>

        <div>
          <Label>Arquivo .pfx ou .p12</Label>
          <Input type="file" accept=".pfx,.p12" onChange={e => setFile(e.target.files?.[0] || null)} />
          {file && <p className="text-xs text-muted-foreground mt-1">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
          🔐 Senha do PFX deve estar configurada como secret <strong>{SECRETS_MAP[empresa]}</strong> no Base44 (Settings → Secrets).
        </div>

        <Button type="submit" disabled={uploading || validando} className="w-full gap-2">
          {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Subindo PFX em storage privado...</>
            : validando ? <><Loader2 className="w-4 h-4 animate-spin" /> Validando certificado...</>
            : <><Upload className="w-4 h-4" /> Validar e Salvar</>}
        </Button>

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