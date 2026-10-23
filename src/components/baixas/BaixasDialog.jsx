import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import BaixasDetalhe from '@/components/baixas/BaixasDetalhe';
import BaixasConfirmacao from '@/components/baixas/BaixasConfirmacao';
import useBaixaContextual from '@/components/baixas/useBaixaContextual';
import { fontesBaixas } from '@/components/baixas/baixasService';

export default function BaixasDialog({ registros, onClose, onSaved, abaInicial = 'dados' }) {
  const [indice, setIndice] = useState(0), registro = registros[indice];
  const b = useBaixaContextual(registro, onSaved);
  const bloqueado = b.busy || !!b.confirmacao;
  return <>
    <Dialog open onOpenChange={open => { if (!open && !bloqueado) onClose(); }}>
      <DialogContent className="w-[calc(100%_-_1.5rem)] max-w-3xl max-h-[92dvh] overflow-y-auto" onInteractOutside={e => { if (bloqueado) e.preventDefault(); }} onEscapeKeyDown={e => { if (bloqueado) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>Baixa e conciliação</DialogTitle><DialogDescription>{fontesBaixas[registro.tipo]} · somente os lançamentos selecionados na tela de origem.</DialogDescription></DialogHeader>
        {registros.length > 1 && <div className="space-y-2 border-b pb-3">
          <label className="text-sm font-medium" htmlFor="baixa-selecionado">Lançamento {indice + 1} de {registros.length}</label>
          <select id="baixa-selecionado" className="w-full rounded-md border bg-background p-2 text-sm" value={indice} disabled={bloqueado} onChange={e => setIndice(Number(e.target.value))}>{registros.map((r, i) => <option key={`${r.tipo}-${r.id}`} value={i}>{i + 1}. {r.descricao || fontesBaixas[r.tipo]}</option>)}</select>
          <p className="text-xs text-muted-foreground">Confira e confirme cada lançamento separadamente. Avançar ou fechar não executa baixas.</p>
        </div>}
        {b.erro && !b.confirmacao && <p role="alert" className="text-sm text-destructive">{b.erro}</p>}
        {b.sucesso && <p role="status" className="text-sm text-success">{b.sucesso}</p>}
        {b.loading ? <p role="status" className="py-8 text-center text-muted-foreground">Carregando documento, saldo e evidências...</p> : b.detalhe ? <BaixasDetalhe key={`${registro.tipo}-${registro.id}-${b.detalhe.registro.versao}`} detalhe={b.detalhe} onSubmit={b.solicitar} abaInicial={abaInicial} contexto={registro} /> : <Button variant="outline" onClick={b.carregar}>Atualizar documento</Button>}
        <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose} disabled={bloqueado}>Voltar à tela de origem</Button>
          {registros.length > 1 && <div className="flex gap-2"><Button variant="outline" disabled={bloqueado || indice === 0} onClick={() => setIndice(i => i - 1)}>Anterior</Button><Button disabled={bloqueado || indice === registros.length - 1} onClick={() => setIndice(i => i + 1)}>Próximo lançamento</Button></div>}
        </div>
      </DialogContent>
    </Dialog>
    <BaixasConfirmacao operacao={b.confirmacao} busy={b.busy} erro={b.erro} onClose={() => b.setConfirmacao(null)} onConfirm={b.executar} />
  </>;
}