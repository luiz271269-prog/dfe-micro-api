import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Paperclip } from 'lucide-react';

export default function AnexoTrabalhistaButton({ uri, url, nome }) {
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  async function abrir() {
    setBusy(true); setError('');
    try {
      const link = uri ? (await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri })).signed_url : url;
      if (link && /^https:\/\//.test(link)) { const a = document.createElement('a'); a.href=link; a.target='_blank'; a.rel='noopener noreferrer'; a.click(); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  if (!uri && !url) return null;
  return <span><Button type="button" variant="outline" size="sm" disabled={busy} onClick={abrir} title={nome || 'Abrir documento'}><Paperclip />{busy ? 'Abrindo...' : 'Documento'}</Button>{error && <span role="alert" className="text-xs text-destructive">{error}</span>}</span>;
}