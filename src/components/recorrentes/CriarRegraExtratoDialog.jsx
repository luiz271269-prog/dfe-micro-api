import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function CriarRegraExtratoDialog({ open, onOpenChange, lancamentos, onEscolher }) {
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const filtrados = lancamentos.filter(l => l.valor < 0 && `${l.descricao} ${l.conta_bancaria || ''}`.toLowerCase().includes(busca.toLowerCase()));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl">
    <DialogHeader><DialogTitle>Criar recorrência pelo extrato</DialogTitle></DialogHeader>
    <p className="text-xs text-muted-foreground">Débitos do período selecionado. Escolha um para preencher a regra e revise antes de salvar.</p>
    <Input placeholder="Buscar descrição ou conta" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }} />
    <div className="max-h-[55vh] overflow-y-auto space-y-2">
      {filtrados.slice(pagina * 30, (pagina + 1) * 30).map(l => <div key={l.id} className="border rounded-lg p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0"><p className="text-sm font-medium break-words">{l.descricao}</p><p className="text-xs text-muted-foreground">{formatDate(l.data)} · {l.conta_bancaria || 'Sem conta'} · {formatCurrency(Math.abs(l.valor))}</p></div>
        <Button size="sm" onClick={() => onEscolher(l)}>Criar regra</Button>
      </div>)}
      {!filtrados.length && <p className="py-6 text-center text-muted-foreground">Nenhum débito encontrado neste período.</p>}
    </div>
    <div className="flex justify-between items-center text-xs"><Button variant="outline" disabled={!pagina} onClick={() => setPagina(pagina - 1)}>Anterior</Button>{filtrados.length} débitos<Button variant="outline" disabled={(pagina + 1) * 30 >= filtrados.length} onClick={() => setPagina(pagina + 1)}>Próxima</Button></div>
  </DialogContent></Dialog>;
}