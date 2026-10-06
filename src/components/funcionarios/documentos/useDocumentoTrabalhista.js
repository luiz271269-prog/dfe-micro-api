import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { processDocument } from '@/functions/processDocument';

export default function useDocumentoTrabalhista(tipo, onChange, onBusy) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const ref = useRef(false);
  async function importar(file) {
    if (!file || ref.current) return;
    if (!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('Use PDF, PNG, JPEG ou WebP de até 10 MB.'); return; }
    ref.current = true; setBusy(true); onBusy?.(true); setError('');
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const { data } = await processDocument({ docType: `rh_${tipo}`, file_uri });
      onChange({ file_uri, nome: file.name, dados: data.dados, avisos: data.avisos, revisado: false });
    } catch (err) { setError(err.response?.data?.error || err.message || 'Não foi possível importar.'); }
    finally { ref.current = false; setBusy(false); onBusy?.(false); }
  }
  function colar(e) {
    const item = Array.from(e.clipboardData?.items || []).find(i => i.kind === 'file' && i.type.startsWith('image/'));
    if (item) { e.preventDefault(); importar(item.getAsFile()); }
  }
  return { busy, error, importar, colar };
}