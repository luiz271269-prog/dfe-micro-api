import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gerenciarEvidenciasFinanceiras } from '@/functions/gerenciarEvidenciasFinanceiras';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/formatters';

// Recebimento manual de um PIX: qualquer parcela em aberto buscada pelo nome do cliente, com justificativa.
export default function PixRecebidoManualDialog({ pix, onReceber, onClose, onSaved }) {
  const sicredi = pix.origem === 'sicredi';
  const nomeInicial = pix.titulos?.[0]?.nome || (!sicredi ? pix.nome : '') || '';
  const inicial = nomeInicial.toUpperCase().split(/[^A-ZÀ-Ú]+/).find(p => p.length >= 4 && p !== 'RECEBIMENTO') || '';
  const [termo, setTermo] = useState(inicial), [busca, setBusca] = useState(inicial);
  const [titulo, setTitulo] = useState(''), [motivo, setMotivo] = useState(''), [erro, setErro] = useState(''), [busy, setBusy] = useState(false);
  const opcoes = useQuery({ queryKey: ['pix-titulos-abertos', busca], queryFn: async () => (await gerenciarEvidenciasFinanceiras({ acao: 'titulos_abertos', termo: busca })).data.titulos });
  const escolhido = opcoes.data?.find(t => t.id === titulo);
  const diferenca = escolhido ? Math.round((pix.disponivel - escolhido.saldo) * 100) / 100 : 0;

  async function salvar() {
    setBusy(true); setErro('');
    try {
      const r = await onReceber(pix, escolhido, motivo.trim());
      if (!r.data?.success) throw new Error(r.data?.error);
      onSaved(); onClose();
    } catch (e) { setErro(e.response?.data?.error || e.message); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{sicredi ? 'Conciliar crédito Sicredi manualmente' : 'Receber PIX manualmente'}</DialogTitle><DialogDescription>{pix.nome} · {formatCurrency(pix.disponivel)} livre · {formatDate(pix.data)}</DialogDescription></DialogHeader>
        {pix.sobreposicao && <p className="text-xs text-warning">Este crédito pode incluir um boleto do relatório. Verifique o relatório e a composição do crédito antes de confirmar.</p>}
        <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); setTitulo(''); setBusca(termo); }}>
          <label className="flex-1 text-sm">Buscar parcela pelo nome do cliente<Input className="mt-1" value={termo} onChange={e => setTermo(e.target.value)} placeholder="Parte do nome (mínimo 3 letras)" /></label>
          <Button type="submit" variant="outline" disabled={termo.trim().length < 3}>Buscar</Button>
        </form>
        {opcoes.isLoading ? <p className="text-sm text-muted-foreground">Buscando parcelas…</p> : opcoes.isError ? <p role="alert" className="text-sm text-destructive">{opcoes.error.response?.data?.error || opcoes.error.message}</p> : (
          <label className="text-sm">Parcela em aberto ({opcoes.data.length})
            <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={titulo} onChange={e => setTitulo(e.target.value)}><option value="">Selecione</option>{opcoes.data.map(t => <option key={t.id} value={t.id}>{t.nome} · {t.referencia || 'sem nº'} · {formatCurrency(t.saldo)} · venc. {formatDate(t.data)}</option>)}</select>
            {!opcoes.data.length && <span className="mt-1 block text-xs text-warning">Nenhuma parcela em aberto para esta busca. Tente outro trecho do nome ou importe o título.</span>}
          </label>
        )}
        {escolhido && Math.abs(diferenca) > 0.01 && <p className="text-xs text-warning">{diferenca > 0 ? `O crédito tem ${formatCurrency(diferenca)} a mais que a parcela. A parcela será quitada e essa diferença fica livre no crédito.` : `O crédito tem ${formatCurrency(-diferenca)} a menos que a parcela. A parcela fica com saldo em aberto.`}</p>}
        <label className="text-sm">Justificativa<Input className="mt-1" maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Por que este crédito paga esta parcela (mínimo 10 caracteres)" /></label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end"><Button disabled={busy || !escolhido || motivo.trim().length < 10} onClick={salvar}>{busy ? 'Recebendo…' : 'Confirmar recebimento'}</Button></div>
      </DialogContent>
    </Dialog>
  );
}