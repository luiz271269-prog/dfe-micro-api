import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2, ExternalLink } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

export default function NFeRecebidaDrawer({ nfe, onClose }) {
  const [xmlUrl, setXmlUrl] = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  async function gerarXmlUrl() {
    if (!nfe.xml_file_uri || xmlUrl) return;
    setLoadingUrl(true);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri: nfe.xml_file_uri, expires_in: 300,
      });
      setXmlUrl(signed_url);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUrl(false);
    }
  }

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {(nfe.tipo_documento || 'doc').toUpperCase()} Nº {nfe.numero_nota || '—'} {nfe.serie ? `série ${nfe.serie}` : ''}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Chave de Acesso</p>
            <p className="font-mono text-[11px] break-all">{nfe.chave_acesso}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-muted-foreground">Tipo</p><p className="font-semibold">{nfe.tipo_documento}</p></div>
            <div><p className="text-muted-foreground">NSU</p><p className="font-semibold font-mono">{nfe.nsu}</p></div>
            <div><p className="text-muted-foreground">Status processamento</p><p className="font-semibold">{nfe.status_processamento}</p></div>
            <div><p className="text-muted-foreground">Manifestação</p><p className="font-semibold">{nfe.status_manifestacao}</p></div>
          </div>

          <div className="border-t pt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Emitente</p>
            <p className="font-semibold">{nfe.nome_emitente || '—'}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {nfe.cnpj_emitente || '—'} {nfe.uf_emitente ? `· ${nfe.uf_emitente}` : ''}
            </p>
            {nfe.natureza_operacao && <p className="text-xs mt-1">Natureza: {nfe.natureza_operacao}</p>}
          </div>

          <div className="border-t pt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Valores</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {nfe.valor_total != null && <div><p className="text-muted-foreground">Total</p><p className="font-bold">{formatCurrency(nfe.valor_total)}</p></div>}
              {nfe.valor_produtos != null && <div><p className="text-muted-foreground">Produtos</p><p className="font-bold">{formatCurrency(nfe.valor_produtos)}</p></div>}
              {nfe.valor_icms != null && <div><p className="text-muted-foreground">ICMS</p><p className="font-bold">{formatCurrency(nfe.valor_icms)}</p></div>}
              {nfe.valor_icms_st != null && <div><p className="text-muted-foreground">ICMS-ST</p><p className="font-bold">{formatCurrency(nfe.valor_icms_st)}</p></div>}
              {nfe.valor_ipi != null && <div><p className="text-muted-foreground">IPI</p><p className="font-bold">{formatCurrency(nfe.valor_ipi)}</p></div>}
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">XML original</p>
            {!nfe.xml_file_uri ? (
              <p className="text-xs text-muted-foreground italic">XML não armazenado</p>
            ) : !xmlUrl ? (
              <Button size="sm" onClick={gerarXmlUrl} disabled={loadingUrl} className="gap-2">
                {loadingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Gerar link de download
              </Button>
            ) : (
              <a href={xmlUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:underline">
                <ExternalLink className="w-3.5 h-3.5" /> Abrir XML em nova aba (válido 5min)
              </a>
            )}
            {nfe.schema_documento && (
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">Schema: {nfe.schema_documento}</p>
            )}
          </div>

          {nfe.erro_processamento && (
            <div className="border-t pt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Erro</p>
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{nfe.erro_processamento}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}