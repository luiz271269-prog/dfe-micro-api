import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Unlink } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function VincularExtratoDespesaDialog({ despesa, vinculo, lancamentos, open, onClose, onChanged }) {
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const opcoes = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return lancamentos.filter(l => {
      const disponivel = Math.abs(l.valor || 0) - (l.valor_conciliado || 0);
      return (l.valor || 0) < 0 && !['conciliado', 'ignorar'].includes(l.status_conciliacao) && disponivel >= (despesa?.valor || 0) - 0.01 && (!q || `${l.descricao} ${l.conta_bancaria} ${l.valor}`.toLowerCase().includes(q));
    }).slice(0, 50);
  }, [busca, despesa, lancamentos]);

  async function executar(payload) {
    setSalvando(true); setErro('');
    try {
      await base44.functions.invoke('vincularExtrato', payload);
      await onChanged?.();
      onClose();
    } catch (e) { setErro(e?.response?.data?.error || e.message || 'Não foi possível concluir o vínculo.'); }
    finally { setSalvando(false); }
  }

  if (!despesa) return null;
  return <Dialog open={open} onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{vinculo ? 'Vínculo com extrato' : 'Vincular despesa ao extrato'}</DialogTitle></DialogHeader>
      <div className="rounded-lg border bg-muted/40 p-3 text-sm"><p className="font-semibold">{despesa.descricao}</p><p className="text-muted-foreground">{despesa.fornecedor || 'Sem fornecedor'} · {formatCurrency(despesa.valor)}</p></div>
      {vinculo ? <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm"><p className="font-semibold text-success">Despesa vinculada</p><p className="mt-1 text-muted-foreground">O pagamento está conciliado com um lançamento bancário.</p></div> : <>
        <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar descrição, conta ou valor..." className="pl-9" /></div>
        <div className="max-h-[42vh] space-y-2 overflow-y-auto">{opcoes.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum débito não conciliado com saldo suficiente.</p> : opcoes.map(l => <button key={l.id} disabled={salvando} onClick={() => executar({ acao:'criar', lancamento_bancario_id:l.id, entidade_tipo:'DespesaOperacional', entidade_id:despesa.id, valor_alocado:despesa.valor, tipo_vinculo:'pagamento_integral', conciliado_por:'manual', confianca:100 })} className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"><span className="min-w-0"><span className="block truncate font-semibold">{l.descricao}</span><span className="block text-xs text-muted-foreground">{formatDate(l.data)} · {l.conta_bancaria || 'Conta não informada'}</span></span><span className="shrink-0 font-bold tabular-nums">{formatCurrency(Math.abs(l.valor || 0))}</span></button>)}</div>
      </>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>{vinculo && <Button variant="destructive" disabled={salvando} onClick={() => executar({ acao:'remover', vinculo_id:vinculo.id })} className="gap-2"><Unlink className="h-4 w-4" />{salvando ? 'Desvinculando...' : 'Desvincular'}</Button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}