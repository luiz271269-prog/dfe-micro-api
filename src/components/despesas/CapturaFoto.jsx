import { useRef, useState } from 'react';
import { Camera, Loader2, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import CameraDialog from './CameraDialog';

// "Tirar foto" abre a câmera ao vivo (webcam do PC ou câmera do celular); "Anexar" usa um arquivo.
// A imagem é enviada e a URL devolvida ao pai, que roda a extração automática dos dados.
export default function CapturaFoto({ titulo, ajuda, onFoto, extraindo = false }) {
  const inputRef = useRef(null);
  const [camera, setCamera] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [preview, setPreview] = useState(null);

  async function enviar(file) {
    if (!file) return;
    setEnviando(true);
    setPreview(URL.createObjectURL(file));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEnviando(false);
    onFoto(file_url, file.name);
  }

  const ocupado = enviando || extraindo;
  return (
    <div className="rounded-xl border bg-muted/30 p-3 flex gap-3 items-start">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-muted-foreground mb-2">{ajuda}</p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { enviar(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="flex gap-2 flex-wrap">
          <Button type="button" size="sm" className="gap-1.5" disabled={ocupado} onClick={() => setCamera(true)}>
            {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {enviando ? 'Enviando...' : extraindo ? 'Lendo dados...' : preview ? 'Tirar outra' : 'Tirar foto'}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={ocupado} onClick={() => inputRef.current?.click()}>
            <Paperclip className="w-4 h-4" /> Anexar
          </Button>
        </div>
      </div>
      {preview && <img src={preview} alt="Foto do comprovante" className="w-24 h-24 object-cover rounded-lg border shrink-0" />}
      <CameraDialog open={camera} onClose={() => setCamera(false)} onCapture={enviar} />
    </div>
  );
}