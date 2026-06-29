import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FolderOpen, Loader2 } from 'lucide-react';

const CONNECTOR_ID = '69e4cc139c63e916cf87b922'; // Drive "Financeiro"

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.defer = true;
    s.onload = resolve; s.onerror = reject;
    document.body.appendChild(s);
  });
}

export default function DriveFolderPicker({ onFolderSelected, label = 'Selecionar pasta no Drive' }) {
  const [loading, setLoading] = useState(false);
  const [pickerReady, setPickerReady] = useState(false);

  useEffect(() => {
    (async () => {
      await loadScript('https://apis.google.com/js/api.js');
      await new Promise(res => window.gapi.load('picker', res));
      setPickerReady(true);
    })();
  }, []);

  async function abrirPicker() {
    setLoading(true);
    try {
      const { accessToken } = await base44.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder');

      const builder = new window.google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .addView(view)
        .setTitle('Selecione a pasta a monitorar')
        .setCallback((data) => {
          if (data.action === window.google.picker.Action.PICKED && data.docs?.[0]) {
            const doc = data.docs[0];
            onFolderSelected({ id: doc.id, name: doc.name });
          }
        });
      builder.build().setVisible(true);
    } catch (e) {
      alert('Erro ao abrir o Google Drive: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={abrirPicker} disabled={!pickerReady || loading} variant="outline" className="gap-2">
      {loading || !pickerReady ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
      {pickerReady ? label : 'Carregando...'}
    </Button>
  );
}