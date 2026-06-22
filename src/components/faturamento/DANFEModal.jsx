import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { gerarDANFEHtml } from '@/functions/gerarDANFEHtml';

export default function DANFEModal({ nf, onClose }) {
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  const [nfeData, setNfeData] = useState(null);

  async function carregar() {
    setLoading(true);
    setError(null);
    try {
      const res = await gerarDANFEHtml({ numero_nota: nf.numero });
      const data = res?.data || res;
      if (data?.error) {
        setError(data.error);
      } else {
        setHtml(data.html);
        setNfeData(data.nfe);
      }
    } catch (e) {
      setError(e.message || 'Falha ao gerar DANFE');
    }
    setLoading(false);
  }

  function abrirEmNovaJanela() {
    if (!html) return;
    const w = window.open('', '_blank', 'width=900,height=900');
    if (!w) { alert('Habilite popups para imprimir o DANFE.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <Dialog open={!!nf} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            DANFE — NF {nf?.numero} · {nf?.cliente}
          </DialogTitle>
        </DialogHeader>

        {!html && !error && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Gere o modelo de impressão (DANFE) a partir do XML da NF-e já processado no sistema.
            </p>
            <Button onClick={carregar} disabled={loading} className="gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : <><Printer className="w-4 h-4" /> Gerar DANFE</>}
            </Button>
          </div>
        )}

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900 mb-1">XML não disponível</p>
                <p className="text-amber-800">{error}</p>
                <p className="text-xs text-amber-700 mt-2">
                  Para gerar o DANFE, o XML desta NF-e precisa estar processado em <strong>Análise NF-e</strong>.
                  Importe o XML da pasta sincronizada no Google Drive e tente novamente.
                </p>
              </div>
            </div>
          </div>
        )}

        {html && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              ✓ DANFE gerado · Emitente: <strong>{nfeData?.emitente_nome}</strong> · Total: <strong>R$ {Number(nfeData?.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={abrirEmNovaJanela} className="gap-2">
                <ExternalLink className="w-4 h-4" /> Abrir para Imprimir / Salvar PDF
              </Button>
              <Button variant="outline" onClick={() => { setHtml(null); setNfeData(null); }}>
                Gerar novamente
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <iframe
                srcDoc={html}
                title="DANFE Preview"
                className="w-full h-[500px] bg-white"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Use "Abrir para Imprimir" para anexar o PDF junto com o XML no e-mail ao cliente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}