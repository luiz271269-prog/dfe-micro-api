import BaixaManualButton from '@/components/shared/BaixaManualButton';

export const FORMAS_PAGAMENTO = {
  pix: 'PIX',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
  cartao: 'Cartão',
  deposito: 'Depósito',
};

export default function BaixaFolhaPopover({ folha, statusLabel, statusColor, onSaved }) {
  return <BaixaManualButton entidade="FolhaPagamento" registroId={folha.id} onSaved={onSaved} className={`h-auto px-2 py-0.5 rounded-full text-[11px] ${statusColor}`}>
    {statusLabel}{folha.status === 'adiantamento' ? ' · Parcial' : ''}
    {folha.forma_pagamento && <span className="ml-1 opacity-70">· {FORMAS_PAGAMENTO[folha.forma_pagamento]}</span>}
  </BaixaManualButton>;
}