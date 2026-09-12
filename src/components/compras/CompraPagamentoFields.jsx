import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const FORMAS_COMPRA = { banco_pix: 'PIX', cartao: 'Cartão', banco_boleto: 'Boleto a prazo', banco_transferencia: 'Transferência bancária', dinheiro: 'Dinheiro', nao_definida: 'Não informada' };
export const EMPTY_COMPRA = { fornecedor: 'COMPRAS A VISTA', numero_nota: '', data_emissao: '', descricao_produto: '', categoria_produto: 'notebook', quantidade: '1', valor_unitario: '', valor_total: '', codigo_produto: '', origem_compra: 'empresa', tipo_compra: 'estoque', forma_pagamento: 'nao_definida', status_pagamento: 'pendente', valor_pago: '', data_vencimento: '' };

export default function CompraPagamentoFields({ value, onChange }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">Produtos para revenda / estoque: o valor integral entra no CMV estimado pela data da compra, mesmo a prazo. O caixa só muda com a movimentação bancária.</p>
    <div className="grid grid-cols-2 gap-4">
      <div><Label>Forma de pagamento</Label><Select value={value.forma_pagamento} onValueChange={v => set('forma_pagamento', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FORMAS_COMPRA).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Pagamento ao fornecedor</Label><Select value={value.status_pagamento} onValueChange={v => set('status_pagamento', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="parcial">Parcial</SelectItem><SelectItem value="pago">Pago ao fornecedor</SelectItem></SelectContent></Select></div>
      <div><Label>Vencimento</Label><Input type="date" value={value.data_vencimento} required={value.forma_pagamento === 'banco_boleto' && value.status_pagamento !== 'pago'} onChange={e => set('data_vencimento', e.target.value)} /></div>
      {value.status_pagamento === 'parcial' && <div><Label>Valor pago</Label><Input type="number" min="0.01" max={value.valor_total || undefined} step="0.01" required value={value.valor_pago} onChange={e => set('valor_pago', e.target.value)} /></div>}
    </div>
    {value.forma_pagamento === 'cartao' && <p className="text-xs text-muted-foreground">Se a compra já foi lançada no cartão, o fornecedor está pago; a saída bancária ocorre ao pagar a fatura.</p>}
  </div>;
}