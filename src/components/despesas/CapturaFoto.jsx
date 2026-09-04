import { useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

// Botão "Tirar foto": abre a câmera (celular) ou o seletor de arquivo (PC), envia a imagem
// e devolve a URL. Em seguida o pai pode rodar a extração automática dos dados.
export default function CapturaFoto({ titulo, ajuda, onFoto, extraindo = false }) {
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [preview, setPreview] = useState(null);

  async function selecionar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
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
        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={selecionar} />
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={ocupado} onClick={() => inputRef.current?.click()}>
          {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : preview ? <RefreshCw className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          {enviando ? 'Enviando...' : extraindo ? 'Lendo dados...' : preview ? 'Tirar outra' : 'Tirar foto'}
        </Button>
      </div>
      {preview && <img src={preview} alt="Foto do comprovante" className="w-24 h-24 object-cover rounded-lg border shrink-0" />}
    </div>
  );
}