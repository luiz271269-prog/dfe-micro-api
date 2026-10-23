import BaixaAcaoRegistro from '@/components/baixas/BaixaAcaoRegistro';

export const FORMAS_PAGAMENTO = {
  pix: 'PIX',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
  cartao: 'Cartão',
  deposito: 'Depósito',
};

export default function BaixaFolhaPopover({ folha, statusLabel, statusColor, onSaved }) {
  return <BaixaAcaoRegistro entidade="FolhaPagamento" registroId={folha.id} descricao={`${folha.funcionario_nome} · ${folha.competencia}`} onSaved={onSaved} className={`h-auto px-2 py-0.5 rounded-full text-[11px] ${statusColor}`}>
    {statusLabel}{folha.status === 'adiantamento' ? ' · Parcial' : ''}
    {folha.forma_pagamento && <span className="ml-1 opacity-70">· {FORMAS_PAGAMENTO[folha.forma_pagamento]}</span>}
  </BaixaAcaoRegistro>;
}