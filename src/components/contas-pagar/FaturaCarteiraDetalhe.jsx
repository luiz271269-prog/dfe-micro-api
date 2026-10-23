import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';
import FaturaSeparacao from '@/components/cartoes/FaturaSeparacao';
export default function FaturaCarteiraDetalhe({ item }) {
  const [aberto, setAberto] = useState(false);
  return <div className="mt-2 space-y-1">
    <p className="text-xs tabular-nums">Total {formatCurrency(item.valor_total)} · Pago registrado {formatCurrency(item.valor_pago)} · Saldo {formatCurrency(item.saldo)}</p>
    <p className="text-xs font-semibold">{item.liquidacao} · {item.temporal}</p>
    {item.inconsistencia_historica && <p className="text-xs text-warning">Situação histórica divergente; revisar sem alteração automática.</p>}
    <Button size="sm" variant="outline" onClick={() => setAberto(true)}>Ver composição e pagamento</Button>
    <Dialog open={aberto} onOpenChange={setAberto}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{item.descricao}</DialogTitle><DialogDescription>Somente a fatura participa do saldo da carteira; os documentos abaixo explicam sua composição.</DialogDescription></DialogHeader>
      {aberto && <FaturaSeparacao faturaId={item.composicao_ref?.fatura_id || item.origem_id}/>}
    </DialogContent></Dialog>
  </div>;
}