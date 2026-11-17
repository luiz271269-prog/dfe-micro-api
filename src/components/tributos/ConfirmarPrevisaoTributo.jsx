import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency } from '@/lib/formatters';

// Previsão de DAS: o usuário informa o valor da guia apurada; só então deixa de ser estimativa.
export default function ConfirmarPrevisaoTributo({ tributo, onSaved }) {
  const [valor, setValor] = useState(String(tributo.valor_original || ''));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  if (!tributo.previsao) return null;
  async function confirmar(e) {
    e.preventDefault();
    const numero = parseFloat(valor);
    if (!(numero > 0)) return setErro('Informe o valor da guia.');
    setSalvando(true); setErro('');
    await base44.entities.Tributo.update(tributo.id, { valor_original: numero, previsao: false, descricao: `DAS ${tributo.competencia}` })
      .then(() => onSaved?.()).catch(err => setErro(err.message)).finally(() => setSalvando(false));
  }
  return <div className="space-y-1">
    <span className="inline-flex rounded-full border border-dashed border-amber-500 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Previsão · não confirmada</span>
    <Popover>
      <PopoverTrigger asChild><Button size="sm" variant="outline" className="h-7 text-xs">Confirmar valor</Button></PopoverTrigger>
      <PopoverContent className="w-72">
        <form onSubmit={confirmar} className="space-y-2">
          <p className="text-xs text-muted-foreground">Faturamento {formatCurrency(tributo.previsao_base || 0)} · alíquota {tributo.previsao_aliquota || 0}%. Informe o valor da guia apurada.</p>
          <Input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} />
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          <Button type="submit" size="sm" className="w-full" disabled={salvando}>{salvando ? 'Salvando...' : 'Confirmar guia'}</Button>
        </form>
      </PopoverContent>
    </Popover>
  </div>;
}