import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gerenciarEvidenciasFinanceiras } from '@/functions/gerenciarEvidenciasFinanceiras';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/formatters';

const SELECT = 'mt-1 w-full rounded-md border bg-background p-2 text-sm';

// Baixa manual: qualquer parcela em aberto + qualquer crédito livre do período, com justificativa.
export default function BaixaManualRecebimentoDialog({ linha, onConfirmar, onClose, onSaved }) {
  const inicial = (linha.contraparte || '').toUpperCase().split(/[^A-ZÀ-Ú0-9]+/).find(p => p.length >= 4) || '';
  const [termo, setTermo] = useState(inicial), [busca, setBusca] = useState(inicial);
  const [titulo, setTitulo] = useState(''), [credito, setCredito] = useState(''), [motivo, setMotivo] = useState(''), [erro, setErro] = useState(''), [busy, setBusy] = useState(false);
  const opcoes = useQuery({ queryKey: ['recebimento-manual', linha.id, busca], queryFn: async () => (await gerenciarEvidenciasFinanceiras({ acao: 'manual_opcoes', evidencia_id: linha.id, termo: busca })).data });
  const escolhido = opcoes.data?.titulos.find(t => t.id === titulo);
  const diferenca = escolhido ? Math.round((linha.valor - escolhido.saldo) * 100) / 100 : 0;

  async function salvar(acao) {
    setBusy(true); setErro('');
    try {
      const r = acao === 'rejeitar' ? await gerenciarEvidenciasFinanceiras({ acao, evidencia_id: linha.id, motivo }) : await onConfirmar(linha, titulo, credito, motivo);
      if (!r.data?.success) throw new Error(r.data?.error);
      onSaved(); onClose();
    } catch (e) { setErro(e.response?.data?.error || e.message); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Baixa manual do recebimento</DialogTitle><DialogDescription>{linha.contraparte} · {formatCurrency(linha.valor)} · pago em {formatDate(linha.data)}</DialogDescription></DialogHeader>
        <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); setTitulo(''); setBusca(termo); }}>
          <label className="flex-1 text-sm">Buscar parcela pelo nome do cliente<Input className="mt-1" value={termo} onChange={e => setTermo(e.target.value)} placeholder="Parte do nome (mínimo 3 letras)" /></label>
          <Button type="submit" variant="outline" disabled={termo.trim().length < 3}>Buscar</Button>
        </form>
        {opcoes.isLoading ? <p className="text-sm text-muted-foreground">Buscando parcelas e créditos…</p> : opcoes.isError ? <p role="alert" className="text-sm text-destructive">{opcoes.error.response?.data?.error || opcoes.error.message}</p> : <>
          <label className="text-sm">Parcela em aberto ({opcoes.data.titulos.length})
            <select className={SELECT} value={titulo} onChange={e => setTitulo(e.target.value)}><option value="">Selecione</option>{opcoes.data.titulos.map(t => <option key={t.id} value={t.id}>{t.nome} · {t.referencia || 'sem nº'} · {formatCurrency(t.saldo)} · venc. {formatDate(t.data)}</option>)}</select>
            {!opcoes.data.titulos.length && <span className="mt-1 block text-xs text-warning">Nenhuma parcela em aberto para esta busca. Tente outro trecho do nome ou importe o título.</span>}
          </label>
          <label className="text-sm">Crédito do extrato ({opcoes.data.creditos.length} livres entre 5 dias antes e 15 dias depois)
            <select className={SELECT} value={credito} onChange={e => setCredito(e.target.value)}><option value="">Selecione</option>{opcoes.data.creditos.map(c => <option key={c.id} value={c.id}>{formatDate(c.data)} · {formatCurrency(c.valor)} ({formatCurrency(c.disponivel)} livre) · {c.nome}</option>)}</select>
          </label>
          {escolhido && Math.abs(diferenca) > 0.01 && <p className="text-xs text-warning">{diferenca > 0 ? `O boleto pagou ${formatCurrency(diferenca)} a mais que a parcela (juros). A parcela será quitada e essa diferença fica livre no crédito.` : `O boleto pagou ${formatCurrency(-diferenca)} a menos que a parcela. A parcela fica com saldo em aberto.`}</p>}
        </>}
        <label className="text-sm">Justificativa<Input className="mt-1" maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Por que esta parcela e este crédito (mínimo 10 caracteres)" /></label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy || motivo.trim().length < 10} onClick={() => salvar('rejeitar')}>Rejeitar boleto</Button>
          <Button disabled={busy || !titulo || !credito || motivo.trim().length < 10} onClick={() => salvar('confirmar')}>{busy ? 'Registrando…' : 'Confirmar baixa manual'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}