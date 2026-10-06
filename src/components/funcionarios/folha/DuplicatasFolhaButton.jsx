import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { gerenciarFolha } from '@/functions/gerenciarFolha';
import { formatCurrency } from '@/lib/formatters';
import { erroFolha } from '@/components/funcionarios/folha/folhaOperacoes';

export default function DuplicatasFolhaButton({ folha, onSaved }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function excluir(registro) {
    if (!window.confirm(`Excluir a folha ${registro.tipo || 'mensal'} de ${registro.funcionario_nome}, ${registro.competencia}, líquido ${formatCurrency(registro.salario_liquido)}? Férias e rescisões vinculadas serão preservadas, mas ficarão sem este vínculo.`)) return;
    setBusy(registro.id); setError('');
    try {
      await gerenciarFolha({ action: 'excluir', id: registro.id });
      await onSaved(); setOpen(false);
    } catch (err) { setError(erroFolha(err)); }
    finally { setBusy(''); }
  }
  if (!folha._duplicatas?.length) return null;
  return <span onClick={e => e.stopPropagation()}>
    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Revisar e excluir folha duplicada" aria-label="Revisar e excluir folha duplicada" onClick={() => { setError(''); setOpen(true); }}><Trash2 /></Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Folhas duplicadas · {folha.competencia}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{folha.funcionario_nome}: mantenha uma folha de cada tipo por mês e confira as verbas antes de excluir; férias, salário e rescisão são registros distintos, e pagamentos ou conciliações são protegidos.</p>
        {folha._duplicatas.map(f => <div key={f.id} className="flex items-center justify-between gap-3 rounded border p-3">
          <div className="text-sm"><b>{f.tipo || 'mensal'}</b> · {formatCurrency(f.salario_liquido)}<p className="text-xs text-muted-foreground">{f.status} · {f.created_date ? new Date(f.created_date).toLocaleString('pt-BR') : f.id}{f.id === folha.id ? ' · exibida na tabela' : ''}</p></div>
          <Button variant="ghost" size="icon" disabled={!!busy} title="Excluir este lançamento" aria-label={`Excluir folha ${f.tipo || 'mensal'}`} onClick={() => excluir(f)} className="text-destructive"><Trash2 className={busy === f.id ? 'animate-pulse' : ''} /></Button>
        </div>)}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  </span>;
}