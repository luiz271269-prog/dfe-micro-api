import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { aplicarRegra } from '@/lib/recurringEngine';
import { ehSaidaContasPagar } from '@/lib/extratoNatureza';
import LinhaConciliacaoRecorrente from '@/components/recorrentes/LinhaConciliacaoRecorrente';

export default function ConciliarRecorrentesDialog({ open, onOpenChange, lancamentos, regras, onRefresh }) {
  const [pagina, setPagina] = useState(0);
  const itens = useMemo(() => lancamentos.filter(l => ehSaidaContasPagar(l) && l.categoria !== 'financeiro').map(lanc => ({
    lanc, matches: regras.map(r => aplicarRegra(lanc, r)).filter(m => m.match),
  })).filter(x => x.matches.length), [lancamentos, regras]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl">
    <DialogHeader><DialogTitle>Conciliar recorrências com o extrato</DialogTitle></DialogHeader>
    <p className="text-xs text-muted-foreground">Revise os débitos do período. Cada confirmação vincula uma despesa existente compatível ou cria uma despesa recorrente paga. Débitos já vinculados e valores divergentes não são conciliados novamente.</p>
    <div className="max-h-[60vh] overflow-y-auto space-y-2">
      {itens.slice(pagina * 30, (pagina + 1) * 30).map(({ lanc, matches }) => <LinhaConciliacaoRecorrente key={lanc.id} lanc={lanc} matches={matches} onRefresh={onRefresh} />)}
      {!itens.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum débito corresponde às regras ativas neste período. Confira a frequência, o mês inicial e a palavra-chave.</p>}
    </div>
    <div className="flex justify-between items-center text-xs"><Button variant="outline" disabled={!pagina} onClick={() => setPagina(pagina - 1)}>Anterior</Button>{itens.length} débitos identificados<Button variant="outline" disabled={(pagina + 1) * 30 >= itens.length} onClick={() => setPagina(pagina + 1)}>Próxima</Button></div>
  </DialogContent></Dialog>;
}