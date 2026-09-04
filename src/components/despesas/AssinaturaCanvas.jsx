import { useEffect, useImperativeHandle, useRef, forwardRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';

// Campo de assinatura à mão livre (dedo, caneta ou mouse). Expõe isEmpty(), clear() e toBlob().
const AssinaturaCanvas = forwardRef(function AssinaturaCanvas(_, ref) {
  const canvasRef = useRef(null);
  const desenhando = useRef(false);
  const [vazio, setVazio] = useState(true);

  useEffect(() => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    c.width = r.width * 2; c.height = r.height * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827';
  }, []);

  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => { e.preventDefault(); desenhando.current = true; const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(...pos(e)); };
  const move = (e) => { if (!desenhando.current) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(...pos(e)); ctx.stroke(); setVazio(false); };
  const up = () => { desenhando.current = false; };

  useImperativeHandle(ref, () => ({
    isEmpty: () => vazio,
    clear: () => { const c = canvasRef.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setVazio(true); },
    toBlob: () => new Promise(res => canvasRef.current.toBlob(res, 'image/png')),
  }), [vazio]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold flex items-center gap-1.5"><PenLine className="w-4 h-4" /> Assine com o dedo</p>
        <button type="button" onClick={() => ref.current?.clear()} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Eraser className="w-3.5 h-3.5" /> Limpar</button>
      </div>
      <canvas ref={canvasRef} className="w-full h-36 rounded-lg border-2 border-dashed bg-background touch-none cursor-crosshair"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} />
    </div>
  );
});

export default AssinaturaCanvas;