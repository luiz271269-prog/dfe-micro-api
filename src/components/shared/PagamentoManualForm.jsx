import { useRef, useState } from 'react';
import { registrarPagamentoManual } from '@/functions/registrarPagamentoManual';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';

export default function PagamentoManualForm({ entidade, registro, saldo, onSaved, onBusy }) {
  const [valor, setValor] = useState(String(saldo));
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState('pix');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const pedidoId = useRef(crypto.randomUUID());
  const formas = { pix: 'PIX', transferencia: 'Transferência', dinheiro: 'Dinheiro', cheque: 'Cheque', cartao: 'Cartão', deposito: 'Depósito', ...(entidade === 'FaturaCartao' ? { boleto: 'Boleto', debito_automatico: 'Débito automático' } : {}) };
  async function salvar(e) {
    e.preventDefault();
    if (saving) return;
    setErro('');
    const quantia = Number(valor);
    if (!Number.isFinite(quantia) || quantia <= 0 || Math.round(quantia * 100) > Math.round(saldo * 100)) { setErro('Informe um valor positivo até o saldo restante.'); return; }
    setSaving(true); onBusy(true);
    try {
      const res = await registrarPagamentoManual({ entidade, id: registro.id, valor: quantia, data, forma, pedidoId: pedidoId.current });
      if (res.data?.error) throw new Error(res.data.error);
      window.dispatchEvent(new Event('neuralfinRefresh'));
      onSaved();
    } catch (err) { setErro(err.response?.data?.error || err.message); }
    finally { setSaving(false); onBusy(false); }
  }
  return <form onSubmit={salvar} className="space-y-3">
    <div><Label htmlFor="baixa-valor">Valor deste pagamento</Label><Input id="baixa-valor" type="number" min="0.01" max={saldo} step="0.01" value={valor} onChange={e => setValor(e.target.value)} required disabled={saving} /></div>
    <div><Label htmlFor="baixa-data">Data efetiva do pagamento</Label><Input id="baixa-data" type="date" max={hoje} value={data} onChange={e => setData(e.target.value)} required disabled={saving} /></div>
    <div><Label htmlFor="baixa-forma">Forma de pagamento</Label><select id="baixa-forma" className="w-full border rounded-md bg-background p-2 text-sm" value={forma} onChange={e => setForma(e.target.value)} disabled={saving}>{Object.entries(formas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    <p className="text-sm">Saldo após pagamento: <b>{formatCurrency(Math.max(0, saldo - (Number(valor) || 0)))}</b></p>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setValor(String(saldo))}>Preencher saldo integral</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : Math.round(Number(valor) * 100) === Math.round(saldo * 100) ? 'Confirmar quitação' : 'Registrar parcial'}</Button></div>
  </form>;
}