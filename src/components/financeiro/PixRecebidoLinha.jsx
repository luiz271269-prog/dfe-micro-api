import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

const SELECT = 'w-full rounded-md border bg-background px-2 py-1 text-xs';
const STATUS = {
  pronto: { rotulo: 'Sugestão para revisar', classe: 'bg-info/10 text-info', linha: '' },
  conferir: { rotulo: 'Múltiplas parcelas', classe: 'bg-warning/10 text-warning', linha: '' },
  sobreposto: { rotulo: 'Possível sobreposição', classe: 'bg-warning/10 text-warning', linha: 'bg-warning/5' },
  sem_parcela: { rotulo: 'Sem parcela', classe: 'bg-warning/10 text-warning', linha: 'bg-warning/5' },
};

// PIX recebido direto na conta, sem boleto liquidado: recebe a parcela contra o próprio crédito.
export default function PixRecebidoLinha({ pix, onReceber, onSalvo, onManual }) {
  const [titulo, setTitulo] = useState(pix.titulo_id);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const escolhido = pix.titulos.find(t => t.id === titulo);
  const cfg = STATUS[pix.sobreposicao ? 'sobreposto' : !pix.titulos.length ? 'sem_parcela' : pix.ambigua ? 'conferir' : 'pronto'];
  const sicredi = pix.origem === 'sicredi';
  const motivo = pix.sobreposicao ? 'O crédito pode corresponder a um boleto já listado.' : !pix.titulos.length ? 'Nenhuma parcela compatível por saldo e data.' : pix.ambigua ? 'Mais de uma parcela coincide. Confira o pagador.' : 'Aguardando sua confirmação.';

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
      <td className="px-3 py-2 max-w-[240px]"><p className="truncate font-medium" title={pix.nome}>{pix.nome}</p><p className="text-[10px] text-muted-foreground">{sicredi ? (pix.sobreposicao ? 'Sicredi · pode incluir boletos do relatório' : 'Sicredi · sem par identificado no relatório') : 'PIX recebido no extrato'}</p></td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">{formatCurrency(pix.disponivel)}</td>
      <td className="w-px bg-border" />
      <td className="px-3 py-2 min-w-[220px]">
        {pix.titulos.length ? <select aria-label="Parcela no sistema" className={SELECT} value={titulo} onChange={e => setTitulo(e.target.value)}><option value="">Selecione</option>{pix.titulos.map(t => <option key={t.id} value={t.id}>{t.referencia || 'sem nº'} · venc. {formatDate(t.data)} · {t.nome}{t.diff_dias != null ? ` · ${t.diff_dias} d de diferença` : ''}</option>)}</select>
          : <span className="text-muted-foreground">{pix.sobreposicao ? 'Confira primeiro o relatório: o crédito pode corresponder a um boleto já listado.' : 'Nenhuma parcela em aberto com o mesmo saldo na janela de datas. Use a baixa manual.'}</span>}
        {pix.sobreposicao && pix.titulos.length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">Confira o relatório antes de usar a opção Manual.</p>}
        {escolhido?.diff_dias != null && <p className="mt-1 text-[10px] text-muted-foreground">Saldo igual · {escolhido.diff_dias === 0 ? 'mesmo dia do vencimento' : `${escolhido.diff_dias} d do vencimento`}{escolhido.nome_compativel ? ' · nome compatível na descrição' : ''}</p>}
      </td>
      <td className="w-px bg-border" />
      <td className="px-3 py-2 min-w-[260px]">{sicredi ? 'Cobrança Sicredi' : 'PIX'} · {formatDate(pix.data)} · {formatCurrency(pix.valor)} ({formatCurrency(pix.disponivel)} livre)</td>
      <td className="px-3 py-2 whitespace-nowrap"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.classe}`}>{cfg.rotulo}</span><p className="mt-1 max-w-[200px] whitespace-normal text-[11px] text-muted-foreground">{motivo}</p>{erro && <p role="alert" className="mt-1 max-w-[200px] whitespace-normal text-[10px] text-destructive">{erro}</p>}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        <Button size="sm" className="h-7 text-xs" disabled={busy || !escolhido || pix.sobreposicao} onClick={receber}>{busy ? 'Conciliando…' : 'Confirmar'}</Button>
        <Button size="sm" variant="outline" className="ml-1 h-7 text-xs" disabled={busy} onClick={() => onManual(pix)}>Manual</Button>
      </td>
    </tr>
  );
}