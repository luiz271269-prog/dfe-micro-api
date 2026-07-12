import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function HomologacaoRescisao({ rescisao, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function homologar() {
    if (!file && !rescisao?.anexo_url) {
      setError('Anexe o termo de rescisão antes de homologar.');
      return;
    }
    setSaving(true);
    let anexo = {};
    if (file) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      anexo = { anexo_url: file_url, anexo_nome: file.name };
    }
    await base44.entities.RescisaoFuncionario.update(rescisao.id, {
      ...anexo,
      homologada: true,
      homologada_em: new Date().toISOString(),
      status: 'homologada',
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return <Dialog open={!!rescisao} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Homologar rescisão</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{rescisao?.funcionario_nome}</p>
      <div><Label>Termo de rescisão (PDF/imagem)</Label><Input type="file" accept=".pdf,image/*" onChange={(e) => { setFile(e.target.files?.[0] || null); setError(''); }} /></div>
      {rescisao?.anexo_nome && <p className="text-xs text-muted-foreground">Anexo atual: {rescisao.anexo_nome}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={homologar} disabled={saving}>{saving ? 'Homologando...' : 'Confirmar homologação'}</Button>
    </DialogContent>
  </Dialog>;
}