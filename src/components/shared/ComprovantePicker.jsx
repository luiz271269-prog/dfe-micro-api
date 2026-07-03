import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Paperclip, Loader2, ExternalLink, X } from 'lucide-react';

const CONNECTOR_ID = '69e4cc139c63e916cf87b922'; // Drive "Financeiro"
// Comprovantes: PDF, imagens (foto/scan) e planilhas/docs comuns
const MIME_TYPES = 'application/pdf,image/jpeg,image/png,image/jpg,image/heic,image/webp,application/vnd.google-apps.document,application/vnd.google-apps.spreadsheet';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.defer = true;
    s.onload = resolve; s.onerror = reject;
    document.body.appendChild(s);
  });
}

/**
 * Botão para anexar um comprovante a partir do Google Drive a qualquer lançamento.
 * Salva o link (webViewLink) + nome do arquivo direto no registro da entidade.
 *
 * @param {string} entityName  - 'DespesaOperacional' | 'LancamentoBancario' | 'LancamentoCartao'
 * @param {object} record      - registro atual (precisa do id e dos campos comprovante_*)
 * @param {function} [onChange] - callback após salvar/remover, recebe os campos atualizados
 */
export default function ComprovantePicker({ entityName, record, onChange }) {
  const [loading, setLoading] = useState(false);
  const [pickerReady, setPickerReady] = useState(false);
  const url = record?.comprovante_drive_url;
  const nome = record?.comprovante_nome;

  useEffect(() => {
    (async () => {
      await loadScript('https://apis.google.com/js/api.js');
      // Após o onload, window.gapi pode ainda não estar disponível — aguarda até aparecer.
      await new Promise((res) => {
        const check = () => {
          if (window.gapi) return res();
          setTimeout(check, 50);
        };
        check();
      });
      await new Promise((res) => window.gapi.load('picker', res));
      setPickerReady(true);
    })();
  }, []);

  async function salvar(campos) {
    await base44.entities[entityName].update(record.id, campos);
    onChange?.(campos);
    window.dispatchEvent(new Event('neuralfinRefresh'));
  }

  async function abrirPicker(e) {
    e.stopPropagation();
    setLoading(true);
    try {
      const { accessToken } = await base44.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
      const view = new window.google.picker.DocsView()
        .setMimeTypes(MIME_TYPES)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);

      const picker = new window.google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .addView(view)
        .setTitle('Selecione o comprovante no Drive')
        .setCallback(async (data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs[0];
            await salvar({
              comprovante_drive_url: doc.url || `https://drive.google.com/file/d/${doc.id}/view`,
              comprovante_nome: doc.name,
            });
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err) {
      alert('Erro ao abrir o Google Drive: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function remover(e) {
    e.stopPropagation();
    await salvar({ comprovante_drive_url: '', comprovante_nome: '' });
  }

  if (url) {
    return (
      <div className="flex items-center gap-1">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title={nome || 'Abrir comprovante no Drive'}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200 transition-colors max-w-[140px]"
        >
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className="truncate">{nome || 'Comprovante'}</span>
        </a>
        <button
          onClick={remover}
          title="Remover comprovante"
          className="text-muted-foreground hover:text-red-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={abrirPicker}
      disabled={!pickerReady || loading}
      title="Anexar comprovante do Google Drive"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
      Anexar
    </button>
  );
}