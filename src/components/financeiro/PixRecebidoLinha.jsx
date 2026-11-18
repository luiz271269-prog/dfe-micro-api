import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

const SELECT = 'w-full rounded-md border bg-background px-2 py-1 text-xs';
const STATUS = {
  pronto: { rotulo: 'Pronto', classe: 'bg-success/10 text-success', linha: '' },
  conferir: { rotulo: 'Conferir parcela', classe: 'bg-info/10 text-info', linha: '' },
  sem_parcela: { rotulo: 'Sem parcela', classe: 'bg-warning/10 text-warning', linha: 'bg-warning/5' },
};

// PIX recebido direto na conta, sem boleto liquidado: recebe a parcela contra o próprio crédito.
export default function PixRecebidoLinha({ pix, onReceber, onSalvo, onManual }) {
  const [titulo, setTitulo] = useState(pix.titulo_id);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const escolhido = pix.titulos.find(t => t.id === titulo);
  const cfg = STATUS[!pix.titulos.length ? 'sem_parcela' : !escolhido || pix.ambigua ? 'conferir' : 'pronto'];

  async function receber() {
    setBusy(true); setErro('');
    try {
      const r = await onReceber(pix, escolhido);
      if (!r.data?.success) throw new Error(r.data?.error);
      onSalvo();
    } catch (e) { setErro(e.response?.data?.error || e.message); } finally { setBusy(false); }
  }

  return (
    <tr className={`border-b align-top ${cfg.linha}`}>
      <td className="px-3 py-2 whitespace-nowrap font-mono">{formatDate(pix.data)}</td>
      <td className="px-3 py-2 max-w-[240px]"><p className="truncate font-medium" title={pix.nome}>{pix.nome}</p><p className="text-[10px] text-muted-foreground">PIX direto na conta · sem boleto liquidado</p></td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">{formatCurrency(pix.disponivel)}</td>
      <td className="w-px bg-border" />
      <td className="px-3 py-2 min-w-[220px]">
        {pix.titulos.length ? <select aria-label="Parcela no sistema" className={SELECT} value={titulo} onChange={e => setTitulo(e.target.value)}><option value="">Selecione</option>{pix.titulos.map(t => <option key={t.id} value={t.id}>{t.referencia || 'sem nº'} · venc. {formatDate(t.data)} · {t.nome}</option>)}</select>
          : <span className="text-muted-foreground">Nenhuma parcela em aberto com este valor. Use a baixa manual.</span>}
      </td>
      <td className="w-px bg-border" />
      <td className="px-3 py-2 min-w-[260px]">PIX · {formatDate(pix.data)} · {formatCurrency(pix.valor)} ({formatCurrency(pix.disponivel)} livre)</td>
      <td className="px-3 py-2 whitespace-nowrap"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.classe}`}>{cfg.rotulo}</span>{erro && <p role="alert" className="mt-1 max-w-[200px] whitespace-normal text-[10px] text-destructive">{erro}</p>}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        <Button size="sm" className="h-7 text-xs" disabled={busy || !escolhido} onClick={receber}>{busy ? 'Recebendo…' : 'Receber'}</Button>
        <Button size="sm" variant="outline" className="ml-1 h-7 text-xs" disabled={busy} onClick={() => onManual(pix)}>Manual</Button>
      </td>
    </tr>
  );
}