import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { fontesBaixas } from '@/components/baixas/baixasService';

const motivoPadrao = c => `${c.origem === 'central' ? `${c.numero} · ${c.fornecedor}` : `${fontesBaixas[c.tipo]} "${c.descricao}"`}: ${c.razoes.slice(0, 3).join('; ')}`.slice(0, 500);

export default function CartaoVinculoForm({ registro, candidato: c, onSubmit }) {
  const central = c.origem === 'central';
  const [parcela, setParcela] = useState(String(c.parcela_sugerida || 1));
  const [motivo, setMotivo] = useState(() => motivoPadrao(c));
  const transacao = `${registro.descricao} · ${formatDate(registro.data)} · ${formatCurrency(registro.total)}`;
  function enviar(e) {
    e.preventDefault();
    if (central) onSubmit({ acao: 'cartaoCentral', pedido_central_internal_id: c.id, parcela: Number(parcela), parcelas: c.opcao.parcelas, motivo }, { operação: 'Vincular transação do cartão ao pedido da Central', transação: transacao, pedido: `${c.numero} · ${c.fornecedor} · ${formatCurrency(c.total)}`, parcela: `${parcela}/${c.opcao.parcelas} · ${formatCurrency(c.opcao.esperado)}`, pagamento_na_central: c.condicao || c.forma_rotulo, efeito: 'Registra o pedido como origem desta compra na fatura. Não altera o pedido na Central nem quita a fatura.' });
    else onSubmit({ acao: 'cartao', destino: c.tipo, destino_id: c.id, destino_versao: c.versao, motivo }, { operação: 'Reconhecer compra no cartão', transação: transacao, documento: `${fontesBaixas[c.tipo]} · ${c.descricao}`, valor: formatCurrency(c.total), saldo_do_documento: formatCurrency(c.saldo) });
  }
  return <form onSubmit={enviar} className="space-y-3 border-t pt-3">
    {central && <div className="space-y-1">
      <Label htmlFor="parcela-central">Parcela representada por esta transação</Label>
      <select id="parcela-central" value={parcela} onChange={e => setParcela(e.target.value)} className="w-full rounded-md border bg-background p-2 text-sm">
        {Array.from({ length: c.opcao.parcelas }, (_, i) => i + 1).map(n => <option key={n} value={n} disabled={c.parcelas_ocupadas.includes(n)}>{n}/{c.opcao.parcelas}{c.parcelas_ocupadas.includes(n) ? ' · já vinculada' : ''}</option>)}
      </select>
    </div>}
    <div className="space-y-1">
      <Label htmlFor="motivo-cartao">Evidência conferida</Label>
      <Input id="motivo-cartao" minLength={10} maxLength={500} required value={motivo} onChange={e => setMotivo(e.target.value)} />
    </div>
    <Button type="submit" size="sm">Revisar vínculo</Button>
  </form>;
}