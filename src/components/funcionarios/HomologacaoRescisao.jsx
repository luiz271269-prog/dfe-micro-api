import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DocumentoTrabalhistaImportador from '@/components/funcionarios/documentos/DocumentoTrabalhistaImportador';
import CalculoManualSeparado from '@/components/funcionarios/documentos/CalculoManualSeparado';
import { dadosDocumentoSalvos } from '@/components/funcionarios/documentos/documentoTrabalhista';

export default function HomologacaoRescisao({ rescisao, onClose, onSaved }) {
  const [documento, setDocumento] = useState(null), [importando, setImportando] = useState(false);
  const [simulacao, setSimulacao] = useState(rescisao?.simulacao_manual || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function homologar() {
    if (saving || importando) return;
    if (documento && !documento.revisado) { setError('Confira os dados importados antes de homologar.'); return; }
    if (!documento?.file_uri && !rescisao?.anexo_url && !rescisao?.documento_file_uri) {
      setError('Anexe o termo de rescisão antes de homologar.');
      return;
    }
    setSaving(true); setError('');
    try {
    await base44.entities.RescisaoFuncionario.update(rescisao.id, {
      ...dadosDocumentoSalvos(documento, simulacao),
      homologada: true,
      homologada_em: new Date().toISOString(),
      status: 'homologada',
    });
    setSaving(false);
    onSaved();
    onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <Dialog open={!!rescisao} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Homologar rescisão</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{rescisao?.funcionario_nome}</p>
      <DocumentoTrabalhistaImportador tipo="rescisao" value={documento} onChange={setDocumento} onBusy={setImportando} disabled={saving} />
      <p className="text-xs text-muted-foreground">Confira o nome com o cadastro acima: esta ação guarda o documento e a simulação, sem substituir as verbas já registradas ou confirmar pagamento.</p>
      <CalculoManualSeparado value={simulacao} onChange={setSimulacao} disabled={saving || importando} />
      {rescisao?.anexo_nome && <p className="text-xs text-muted-foreground">Anexo atual: {rescisao.anexo_nome}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={homologar} disabled={saving || importando || (!!documento && !documento.revisado)}>{saving ? 'Homologando...' : 'Confirmar homologação'}</Button>
    </DialogContent>
  </Dialog>;
}