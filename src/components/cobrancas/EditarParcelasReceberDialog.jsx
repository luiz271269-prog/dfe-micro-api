import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { editarParcelasReceber } from '@/functions/editarParcelasReceber';
import { formatCurrency } from '@/lib/formatters';
import ParcelasReceberTabela from '@/components/cobrancas/ParcelasReceberTabela';

const cents = v => Math.round(Number(v) * 100);
const mensagem = e => e.response?.data?.error || e.data?.error || e.message;

export default function EditarParcelasReceberDialog({ tituloId, onClose, onSaved }) {
  const [estado, setEstado] = useState(null), [linhas, setLinhas] = useState([]), [erro, setErro] = useState(''), [salvando, setSalvando] = useState(false);
  useEffect(() => {
    let ativo = true;
    editarParcelasReceber({ acao: 'consultar', titulo_id: tituloId }).then(({ data }) => {
      if (!ativo) return;
      setLinhas((data.parcelas || []).map(l => ({ ...l, key: l.id, valor: String(l.valor_titulo) })));
      setEstado(data);
    }).catch(e => { if (ativo) setErro(mensagem(e)); });
    return () => { ativo = false; };
  }, [tituloId]);
  const total = linhas.reduce((s, l) => s + cents(l.valor || 0), 0), diferenca = cents(estado?.nota?.valor_total) - total;
  const desabilitado = salvando || !!estado?.bloqueio;
  const mudou = linhas.length !== estado?.parcelas?.length || linhas.some((l, i) => cents(l.valor) !== cents(estado.parcelas[i]?.valor_titulo) || l.data_vencimento !== estado.parcelas[i]?.data_vencimento);
  async function salvar(e) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      await editarParcelasReceber({ acao: 'salvar', titulo_id: tituloId, versao: estado.versao, linhas: linhas.filter(l => !l.bloqueada).map(l => ({ id: l.id, data_vencimento: l.data_vencimento, centavos: cents(l.valor) })) });
    } catch (e) { setErro(mensagem(e)); setSalvando(false); return; }
    onClose(); onSaved();
  }
  return <Dialog open onOpenChange={aberto => { if (!aberto && !salvando) onClose(); }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
    <DialogHeader><DialogTitle>Editar parcelas a receber</DialogTitle><DialogDescription>{estado?.nota ? `${estado.nota.tipo} ${estado.nota.numero} · ${estado.nota.cliente}` : 'Consulte o parcelamento do documento.'}</DialogDescription></DialogHeader>
    {!estado && !erro && <p role="status" className="text-sm text-muted-foreground">Conferindo todas as parcelas e seus pagamentos…</p>}
    {estado?.bloqueio && <p className="text-sm text-muted-foreground">{estado.bloqueio}</p>}
    {estado?.nota && <form onSubmit={salvar} className="space-y-3">
      <p className="text-xs text-muted-foreground">Parcelas com pagamento total, parcial ou vínculo bancário ficam bloqueadas. Alterações valem só neste sistema, sem emitir ou alterar boletos no banco.</p>
      <ParcelasReceberTabela linhas={linhas} desabilitado={desabilitado} onChange={(key, campo, valor) => setLinhas(ls => ls.map(l => l.key === key ? { ...l, [campo]: valor } : l))} onRemove={key => setLinhas(ls => ls.filter(l => l.key !== key))} />
      <div className="flex flex-wrap items-center justify-between gap-2"><Button type="button" variant="outline" size="sm" disabled={desabilitado || linhas.length >= 60} onClick={() => setLinhas(ls => [...ls, { key: crypto.randomUUID(), data_vencimento: '', valor: '' }])}>Adicionar parcela</Button><p aria-live="polite" className="text-sm tabular-nums">Documento: <strong>{formatCurrency(estado.nota.valor_total)}</strong> · Parcelas: <strong>{formatCurrency(total / 100)}</strong><br /><span className={diferenca ? 'text-destructive' : 'text-success'}>{diferenca ? `${diferenca > 0 ? 'Falta' : 'Excede em'} ${formatCurrency(Math.abs(diferenca) / 100)}` : 'Total confere'}</span></p></div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={salvando} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={desabilitado || diferenca !== 0 || !mudou}>{salvando ? 'Salvando…' : 'Salvar parcelas'}</Button></div>
    </form>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </DialogContent></Dialog>;
}