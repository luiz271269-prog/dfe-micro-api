import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useSugestoesCartao from '@/components/baixas/cartao/useSugestoesCartao';
import CartaoSecaoCentral from '@/components/baixas/cartao/CartaoSecaoCentral';
import CartaoSecaoLocais from '@/components/baixas/cartao/CartaoSecaoLocais';

export default function CartaoSugestoes({ registro, onSubmit }) {
  const s = useSugestoesCartao(registro);
  const [texto, setTexto] = useState('');
  const [sel, setSel] = useState(null);
  const buscar = valor => { setSel(null); s.buscar(valor); };
  const props = { registro, sel, onSelect: setSel, onSubmit };
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Sugestões automáticas comparando valor, parcelas, forma de pagamento, fornecedor e data com os pedidos da Central e os documentos registrados. Vincular a compra não quita a fatura.</p>
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); buscar(texto.trim()); }}>
      <Input placeholder="Buscar por fornecedor, nº do pedido ou produto" maxLength={100} value={texto} onChange={e => setTexto(e.target.value)} />
      <Button type="submit" variant="outline">Buscar</Button>
      {s.busca && <Button type="button" variant="ghost" onClick={() => { setTexto(''); buscar(''); }}>Ver sugestões</Button>}
    </form>
    {s.isLoading && <p role="status" className="text-sm text-muted-foreground">Procurando documentos compatíveis...</p>}
    {s.error && <p role="alert" className="text-sm text-destructive">{s.error.message} <button type="button" className="underline" onClick={() => s.refetch()}>Tentar novamente</button></p>}
    {s.data?.ocupado && <p className="rounded-lg border p-3 text-sm">Esta transação já possui documento vinculado. Para trocar, desfaça o vínculo em “Histórico e reversões”.</p>}
    {s.data && !s.data.elegivel && <p className="text-sm text-muted-foreground">Esta linha não é uma compra da fatura (pagamento, estorno ou ajuste) e não recebe vínculo de documento.</p>}
    {s.data && s.data.elegivel && !s.data.ocupado && <>
      <CartaoSecaoCentral central={s.data.central} {...props} />
      <CartaoSecaoLocais locais={s.data.locais} {...props} />
    </>}
  </div>;
}