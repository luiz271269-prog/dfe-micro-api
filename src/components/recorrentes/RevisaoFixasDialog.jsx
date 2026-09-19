import { useState } from 'react';
import { revisarDespesasFixas } from '@/functions/revisarDespesasFixas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import RevisaoFixaLinha from '@/components/recorrentes/RevisaoFixaLinha';

export default function RevisaoFixasDialog({ open, onOpenChange, inicio, fim, sugestoes, onRefresh }) {
  const [busy, setBusy] = useState(false), [erro, setErro] = useState(''), [mensagem, setMensagem] = useState('');
  const [pagina, setPagina] = useState(0), [status, setStatus] = useState('pendente');
  const itens = sugestoes.filter(s => s.competencia >= inicio && s.competencia <= fim && s.status === status).sort((a, b) => a.data_extrato.localeCompare(b.data_extrato));
  async function analisar() {
    setBusy(true); setErro(''); setMensagem(''); setPagina(0);
    try {
      let mes = inicio;
      for (let i = 0; mes <= fim && i < 12; i++) {
        setMensagem(`Analisando ${mes}...`);
        const res = await revisarDespesasFixas({ acao: 'analisar', mes });
        if (!res.data?.success) throw new Error(res.data?.error || 'Não foi possível analisar');
        const [a, m] = mes.split('-').map(Number);
        mes = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 7);
      }
      await onRefresh();
      setMensagem('Análise concluída. Revise as correspondências antes de confirmar.');
    } catch (e) { setErro(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v); }}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Revisar despesas fixas</DialogTitle><DialogDescription>Extrato = pagamento. Cartão = compra. Nenhum vínculo é confirmado pela análise.</DialogDescription></DialogHeader>
    <div className="flex flex-wrap gap-2 items-center"><Button disabled={busy} onClick={analisar}>{busy ? 'Analisando...' : 'Analisar período'}</Button><select aria-label="Status das sugestões" className="border rounded-md bg-background p-2 text-sm" value={status} onChange={e => { setStatus(e.target.value); setPagina(0); }}><option value="pendente">Aguardando revisão</option><option value="confirmada">Confirmadas</option><option value="rejeitada">Rejeitadas</option></select></div>
    <p className="text-xs text-muted-foreground">{inicio} a {fim} · {itens.length} sugestão(ões)</p>
    {mensagem && <p role="status" className="text-xs text-muted-foreground">{mensagem}</p>}{erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    <div className="space-y-3">{itens.slice(pagina * 20, (pagina + 1) * 20).map(s => <RevisaoFixaLinha key={s.id} sugestao={s} onRefresh={onRefresh} disabled={busy} />)}{!itens.length && <p className="text-sm text-muted-foreground py-6">Nenhuma sugestão neste status. Use Analisar período para cruzar as fixas cadastradas com extrato e cartão.</p>}</div>
    <div className="flex justify-between"><Button variant="outline" disabled={!pagina || busy} onClick={() => setPagina(pagina - 1)}>Anterior</Button><Button variant="outline" disabled={(pagina + 1) * 20 >= itens.length || busy} onClick={() => setPagina(pagina + 1)}>Próxima</Button></div>
  </DialogContent></Dialog>;
}