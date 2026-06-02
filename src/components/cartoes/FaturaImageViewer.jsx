import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, ExternalLink, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FaturaImageViewer({ open, onOpenChange, fileUrl, titulo }) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => { if (open) setZoom(1); }, [open]);

  if (!fileUrl) return null;
  const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(fileUrl);
  const isPdf = /\.pdf(\?|$)/i.test(fileUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
          <p className="text-sm font-semibold truncate">{titulo || 'Fatura original'}</p>
          <div className="flex items-center gap-1.5">
            {isImage && (
              <>
                <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="gap-1 h-7 px-2">
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="gap-1 h-7 px-2">
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 h-7 px-2">
                <ExternalLink className="w-3.5 h-3.5" /> Abrir
              </Button>
            </a>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 w-7 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-muted/30 flex items-start justify-center p-4">
          {isImage ? (
            <img
              src={fileUrl}
              alt={titulo}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
              className="max-w-full transition-transform shadow-lg rounded-md"
            />
          ) : isPdf ? (
            <iframe src={fileUrl} title={titulo} className="w-full h-full min-h-[80vh] border-0 bg-white rounded-md" />
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Pré-visualização não disponível para este formato.</p>
              <a href={fileUrl} target="_blank" rel="noreferrer">
                <Button className="gap-2"><ExternalLink className="w-4 h-4" /> Abrir arquivo</Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}