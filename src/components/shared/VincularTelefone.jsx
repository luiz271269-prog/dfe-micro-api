import { useState } from 'react';
import { MessageCircle, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Botão cinza "vincular": abre campo para informar o WhatsApp e salvar no cadastro.
export default function VincularTelefone({ onSalvar, compact, className = '' }) {
  const [open, setOpen] = useState(false);
  const [tel, setTel] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    if (!tel.trim()) return;
    setSalvando(true);
    await onSalvar(tel.trim());
    setSalvando(false);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title="Vincular WhatsApp" onClick={e => e.stopPropagation()}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold border border-dashed border-emerald-400 text-emerald-700 hover:bg-emerald-50 transition-colors ${compact ? 'h-7 w-7 justify-center' : 'h-7 px-2.5 text-xs'} ${className}`}>
          <MessageCircle className="w-3.5 h-3.5" />{!compact && 'Vincular WhatsApp'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" onClick={e => e.stopPropagation()}>
        <form onSubmit={salvar} className="space-y-2">
          <p className="text-xs font-semibold">WhatsApp com DDD</p>
          <Input autoFocus placeholder="(51) 99999-9999" value={tel} onChange={e => setTel(e.target.value)} inputMode="tel" />
          <Button type="submit" size="sm" className="w-full gap-1.5" disabled={salvando}><Check className="w-3.5 h-3.5" /> Salvar e abrir conversa</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}