import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function VinculosMultiSelect({ itens, value = [], onChange, placeholder }) {
  const selecionados = new Set(value);
  const toggle = chave => onChange(selecionados.has(chave) ? value.filter(x => x !== chave) : [...value, chave]);
  const resumo = value.length ? `${value.length} selecionado${value.length > 1 ? 's' : ''}` : placeholder;
  return <Popover>
    <PopoverTrigger asChild><Button type="button" variant="outline" className="h-9 w-full justify-between px-2 font-normal"><span className="truncate">{resumo}</span><ChevronDown className="h-4 w-4 opacity-50" /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-64 p-2">
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {itens.map(item => <label key={item.chave} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"><Checkbox checked={selecionados.has(item.chave)} onCheckedChange={() => toggle(item.chave)} /><span>{item.rotulo}</span></label>)}
      </div>
    </PopoverContent>
  </Popover>;
}