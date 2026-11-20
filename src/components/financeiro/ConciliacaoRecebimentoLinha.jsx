import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

const SELECT = 'w-full rounded-md border bg-background px-2 py-1 text-xs';
const STATUS = {
  pronto: { rotulo: 'Pronto', classe: 'bg-success/10 text-success', linha: '' },
  conferir: { rotulo: 'Conferir opções', classe: 'bg-info/10 text-info', linha: '' },
  baixado: { rotulo: 'Já baixado', classe: 'bg-success/10 text-success', linha: 'bg-success/5' },
  sem_parcela: { rotulo: 'Sem parcela', classe: 'bg-warning/10 text-warning', linha: 'bg-warning/5' },
  sem_credito: { rotulo: 'Sem crédito', classe: 'bg-destructive/10 text-destructive', linha: 'bg-destructive/5' },
};

export default function ConciliacaoRecebimentoLinha({ linha, onConfirmar, onSalvo, onManual }) {
  const [titulo, setTitulo] = useState(linha.titulo_id);
  const [credito, setCredito] = useState(linha.credito_id);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const baixado = !linha.titulos.length && linha.baixado;
  const estado = baixado ? 'baixado' : !linha.titulos.length ? 'sem_parcela' : !linha.creditos.length ? 'sem_credito' : linha.ambigua || !titulo || !credito ? 'conferir' : 'pronto';
  const cfg = STATUS[estado];
  const tituloFinal = baixado ? baixado.titulo_id : titulo, creditoFinal = baixado ? baixado.credito_id : credito;

  async function confirmar() {
    setBusy(true); setErro('');
    try {
      const r = await onConfirmar(linha, tituloFinal, creditoFinal);
      if (!r.data?.success) throw new Error(r.data?.error);
      onSalvo();
    } catch (e) { setErro(e.response?.data?.error || e.message); } finally { setBusy(false); }
  }

  return (
    <tr className={`border-b align-top ${cfg.linha}`}>
      <td className="px-3 py-2 whitespace-nowrap font-mono">{formatDate(linha.data)}</td>
      <td className="px-3 py-2 max-w-[240px]"><p className="truncate font-medium" title={linha.contraparte}>{linha.contraparte}</p><p className="truncate text-[10px] text-muted-foreground" title={linha.arquivo_nome}>venc. {formatDate(linha.vencimento)} · {linha.arquivo_nome}</p></td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">{formatCurrency(linha.valor)}</td>
      <td className="w-px bg-border" />
      <td className="px-3 py-2 min-w-[220px]">
        {baixado ? <span>{baixado.referencia || 'Parcela'} · já baixada em {formatDate(baixado.data_pagamento)}</span>
          : linha.titulos.length ? <select aria-label="Parcela no sistema" className={SELECT} value={titulo} onChange={e => setTitulo(e.target.value)}>{linha.titulos.map(t => <option key={t.id} value={t.id}>{t.referencia || 'sem nº'} · venc. {formatDate(t.data)} · {t.nome}</option>)}</select>
          : <span className="text-muted-foreground">Nenhuma parcela em aberto com este pagador e valor. Use a baixa manual.</span>}
      </td>
      <td className="w-px bg-border" />
      <td className="px-3 py-2 min-w-[260px]">
        {baixado ? <span className="text-muted-foreground">Crédito já vinculado a esta parcela</span>
          : linha.creditos.length ? <select aria-label="Crédito no extrato" className={SELECT} value={credito} onChange={e => setCredito(e.target.value)}><option value="">Selecione</option>{linha.creditos.map(c => <option key={c.id} value={c.id}>{formatDate(c.data)} · {formatCurrency(c.valor)} ({formatCurrency(c.disponivel)} livre) · {c.nome}{c.motivo ? ` · ${c.motivo}` : ''}</option>)}</select>
          : <span className="text-muted-foreground">Nenhum crédito de cobrança ou PIX compatível na janela de 3 dias. Use a baixa manual.</span>}
      </td>
      <td className="px-3 py-2 whitespace-nowrap"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.classe}`}>{cfg.rotulo}</span>{erro && <p role="alert" className="mt-1 max-w-[200px] whitespace-normal text-[10px] text-destructive">{erro}</p>}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        <Button size="sm" className="h-7 text-xs" disabled={busy || !tituloFinal || !creditoFinal} onClick={confirmar}>{busy ? 'Conciliando…' : baixado ? 'Concluir' : 'Confirmar'}</Button>
        <Button size="sm" variant="outline" className="ml-1 h-7 text-xs" disabled={busy} onClick={() => onManual(linha)}>Manual</Button>
      </td>
    </tr>
  );
}