import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatters';

export const FORMAS_PAGAMENTO = {
  pix: 'PIX',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
  cartao: 'Cartão',
  deposito: 'Depósito',
};

export default function BaixaFolhaPopover({ folha, statusLabel, statusColor, onSaved }) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState(folha.forma_pagamento || 'pix');
  const [data, setData] = useState(folha.data_pagamento || new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const abrir = (v) => {
    setOpen(v);
    if (v) {
      setValor(String(folha.valor_pago || folha.salario_liquido || ''));
      setForma(folha.forma_pagamento || 'pix');
      setData(folha.data_pagamento || new Date().toISOString().slice(0, 10));
    }
  };

  const salvar = async (marcarPago) => {
    setSaving(true);
    const v = parseFloat(valor) || 0;
    await base44.entities.FolhaPagamento.update(folha.id, {
      valor_pago: v,
      forma_pagamento: forma,
      data_pagamento: data || null,
      status: marcarPago ? 'pago' : (v > 0 ? 'adiantamento' : 'pendente'),
    });
    setSaving(false);
    setOpen(false);
    onSaved?.();
  };

  return (
    <Popover open={open} onOpenChange={abrir}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusColor} hover:ring-1 hover:ring-primary/40`}>
          {statusLabel}
          {folha.forma_pagamento && <span className="ml-1 opacity-70">· {FORMAS_PAGAMENTO[folha.forma_pagamento]}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-bold uppercase text-muted-foreground">Baixa de pagamento</p>
        <p className="text-xs">Líquido: <b>{formatCurrency(folha.salario_liquido)}</b></p>
        <div><Label className="text-xs">Valor pago</Label><Input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} /></div>
        <div><Label className="text-xs">Como foi pago</Label>
          <Select value={forma} onValueChange={setForma}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(FORMAS_PAGAMENTO).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Data do pagamento</Label><Input type="date" value={data} onChange={e => setData(e.target.value)} /></div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={saving} onClick={() => salvar(true)}>Marcar pago</Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => salvar(false)}>Parcial</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}