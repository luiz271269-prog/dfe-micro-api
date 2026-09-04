import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LancarDespesaFotoDialog from './LancarDespesaFotoDialog';

export default function LancarDespesaFotoButton({ onSaved, size = 'sm', variant = 'default' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)} className="gap-1.5">
        <Camera className="w-4 h-4" /> Lançar por foto
      </Button>
      <LancarDespesaFotoDialog open={open} onClose={() => setOpen(false)} onSaved={onSaved} />
    </>
  );
}