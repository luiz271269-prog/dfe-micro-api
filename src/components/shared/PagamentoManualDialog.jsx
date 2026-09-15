import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';
import HistoricoBaixasManuais from '@/components/shared/HistoricoBaixasManuais';
import PagamentoManualForm from '@/components/shared/PagamentoManualForm';

export default function PagamentoManualDialog({ entidade, registroId, onClose, onSaved }) {
  const [registro, setRegistro] = useState(null);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let ativo = true;
    base44.entities[entidade].get(registroId).then(r => { if (ativo) setRegistro(r); }).catch(e => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [entidade, registroId]);
  const total = Number(entidade === 'FolhaPagamento' ? registro?.salario_liquido : registro?.valor_total) || 0;
  const pago = registro?.valor_pago || 0;
  const saldo = Math.max(0, Math.round((total - pago) * 100) / 100);
  const quitado = ['pago', 'paga_total'].includes(registro?.status) || saldo === 0;
  return <Dialog open onOpenChange={v => { if (!v && !busy) onClose(); }}>
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Pagamento manual · {entidade === 'FolhaPagamento' ? 'Folha' : 'Fatura'}</DialogTitle></DialogHeader>
      {erro ? <p role="alert" className="text-destructive">{erro}</p> : !registro ? <p className="text-muted-foreground">Carregando saldo...</p> : <>
        <p className="text-sm">{registro.funcionario_nome || `Fatura ${registro.mes_referencia}`} · Total: <b>{formatCurrency(total)}</b><br />Pago acumulado: <b>{formatCurrency(pago)}</b> · Saldo: <b>{formatCurrency(saldo)}</b></p>
        {!quitado ? <PagamentoManualForm entidade={entidade} registro={registro} saldo={saldo} onBusy={setBusy} onSaved={() => { onClose(); onSaved?.(); }} /> : <p className="font-semibold text-primary">Obrigação quitada.</p>}
        <HistoricoBaixasManuais registro={registro} />
      </>}
    </DialogContent>
  </Dialog>;
}