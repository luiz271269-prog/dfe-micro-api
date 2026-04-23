import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FolderOpen, Loader2 } from 'lucide-react';

const CONNECTOR_ID = '69e4cc139c63e916cf87b922'; // Drive "Financeiro"
// API Key pública do Picker — obtida via Google Cloud Console do mesmo projeto OAuth.
// Sem API key o Picker exibe apenas o view padrão (arquivos do usuário via OAuth), que é o que queremos.
const PICKER_API_KEY = '';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.defer = true;
    s.onload = resolve; s.onerror = reject;
    document.body.appendChild(s);
  });
}

export default function GoogleDrivePicker({ onFilesSelected }) {
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
      const view = new window.google.picker.DocsView()
        .setMimeTypes('application/xml,text/xml')
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);

      const builder = new window.google.picker.PickerBuilder()
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(accessToken)
        .addView(view)
        .setTitle('Selecione XMLs de NF-e da pasta Financeiro')
        .setCallback((data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const fileIds = data.docs.map(d => d.id);
            const files = data.docs.map(d => ({ id: d.id, name: d.name }));
            onFilesSelected(fileIds, files);
          }
        });
      if (PICKER_API_KEY) builder.setDeveloperKey(PICKER_API_KEY);
      builder.build().setVisible(true);
    } catch (e) {
      alert('Erro ao abrir Google Drive Picker: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={abrirPicker} disabled={!pickerReady || loading} className="gap-2 bg-blue-600 hover:bg-blue-700">
      {loading || !pickerReady ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
      {pickerReady ? 'Selecionar XMLs no Drive' : 'Carregando Picker...'}
    </Button>
  );
}