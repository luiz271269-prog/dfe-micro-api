import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, SwitchCamera, X } from 'lucide-react';

// Abre a câmera ao vivo (webcam no PC, câmera traseira no celular) e devolve a foto como File.
export default function CameraDialog({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setErro('');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(stream => {
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setErro('Não foi possível acessar a câmera. Verifique a permissão do navegador.'));
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [open, facing]);

  function disparar() {
    const v = videoRef.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob(blob => {
      onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      onClose();
    }, 'image/jpeg', 0.92);
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl p-0 overflow-hidden bg-black border-0">
        <DialogTitle className="sr-only">Câmera</DialogTitle>
        <div className="relative aspect-[4/3] bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
          {erro && <p className="absolute inset-0 flex items-center justify-center text-white text-sm text-center px-6">{erro}</p>}
          <button type="button" onClick={onClose} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center justify-center gap-3 p-3 bg-black">
          <Button type="button" variant="secondary" size="icon" onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')} title="Trocar câmera"><SwitchCamera className="w-4 h-4" /></Button>
          <Button type="button" onClick={disparar} disabled={!!erro} className="gap-2 h-12 px-8 rounded-full"><Camera className="w-5 h-5" /> Capturar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}