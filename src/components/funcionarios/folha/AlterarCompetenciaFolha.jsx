import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { gerenciarFolha } from '@/functions/gerenciarFolha';

export default function AlterarCompetenciaFolha({ folha, onSaved }) {
  const [open, setOpen] = useState(false), [valor, setValor] = useState(folha.competencia), [salvando, setSalvando] = useState(false), [erro, setErro] = useState('');
  async function salvar() {
    setSalvando(true); setErro('');
    try { await gerenciarFolha({ action: 'alterar_competencia', id: folha.id, competencia: valor }); setOpen(false); await onSaved?.(); }
    catch (e) { setErro(e?.response?.data?.error || e.message); }
    finally { setSalvando(false); }
  }
  return <span onClick={e => e.stopPropagation()}>
    <Popover open={open} onOpenChange={o => { setOpen(o); setValor(folha.competencia); setErro(''); }}>
      <PopoverTrigger asChild>
        <button title="Alterar competência" className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary">
          <CalendarClock className="w-3 h-3" /> {folha.competencia}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3">
        <div>
          <p className="text-sm font-semibold">Alterar competência</p>
          <p className="text-xs text-muted-foreground">Muda só o mês de referência. Vínculos de pagamento, valores e status ficam como estão.</p>
        </div>
        <Input type="month" value={valor} onChange={e => setValor(e.target.value)} />
        {erro && <p className="text-xs text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" disabled={salvando || !valor || valor === folha.competencia} onClick={salvar}>
            {salvando && <Loader2 className="w-3 h-3 animate-spin" />} Salvar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  </span>;
}