import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, ShieldCheck, AlertCircle } from 'lucide-react';

export default function UploadCertificadoForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    empresa: 'NeuralTec',
    cnpj: '',
    ambiente: 'producao',
    senha_secret_name: 'CERT_PFX_NEURALTEC',
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setError('Selecione o arquivo .pfx');
    if (!form.cnpj || form.cnpj.replace(/\D/g, '').length !== 14) return setError('CNPJ inválido (14 dígitos)');
    if (!file.name.match(/\.(pfx|p12)$/i)) return setError('Arquivo precisa ser .pfx ou .p12');
    setError('');
    setBusy(true);
    try {
      // Upload privado — Base44 storage seguro
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });

      await base44.entities.CertificadoDigitalNFe.create({
        empresa: form.empresa,
        cnpj: form.cnpj,
        cnpj_sem_mascara: form.cnpj.replace(/\D/g, ''),
        tipo: 'A1',
        file_uri,
        senha_secret_name: form.senha_secret_name,
        ambiente: form.ambiente,
        is_ativo: true,
        status_validacao: 'pendente',
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Falha ao salvar');
    }
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Novo Certificado A1
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Empresa</Label>
              <Select
                value={form.empresa}
                onValueChange={v => setForm({
                  ...form,
                  empresa: v,
                  senha_secret_name: v === 'NeuralTec' ? 'CERT_PFX_NEURALTEC' : 'CERT_PFX_LIESCH',
                })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NeuralTec">NeuralTec</SelectItem>
                  <SelectItem value="Liesch">Liesch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ambiente</Label>
              <Select value={form.ambiente} onValueChange={v => setForm({ ...form, ambiente: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="producao">Produção</SelectItem>
                  <SelectItem value="homologacao">Homologação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>CNPJ</Label>
            <Input
              placeholder="XX.XXX.XXX/XXXX-XX"
              value={form.cnpj}
              onChange={e => setForm({ ...form, cnpj: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Nome do Secret da Senha</Label>
            <Input
              value={form.senha_secret_name}
              onChange={e => setForm({ ...form, senha_secret_name: e.target.value })}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Este secret precisa estar configurado no painel do Base44 com a senha do .pfx. A senha nunca fica salva no banco.</span>
            </p>
          </div>

          <div>
            <Label>Arquivo .pfx</Label>
            <div
              className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary cursor-pointer transition-colors"
              onClick={() => document.getElementById('pfx-input').click()}
            >
              <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
              {file ? (
                <p className="text-sm font-semibold">{file.name} <span className="text-[10px] text-muted-foreground">({(file.size/1024).toFixed(1)} KB)</span></p>
              ) : (
                <p className="text-xs text-muted-foreground">Clique para selecionar o .pfx ou .p12</p>
              )}
              <input
                id="pfx-input"
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={e => setFile(e.target.files[0])}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Salvando...' : 'Salvar Certificado'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}