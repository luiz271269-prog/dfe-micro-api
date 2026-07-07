const statusConfig = {
  pago: { label: 'Pago', className: 'bg-green-500/10 text-green-700 border-green-200' },
  parcial: { label: 'Parcial', className: 'bg-yellow-500/10 text-yellow-700 border-yellow-200' },
  a_vencer: { label: 'A Vencer', className: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  vencido: { label: 'Vencido', className: 'bg-red-500/10 text-red-700 border-red-200' },
  em_aberto: { label: 'Em Aberto', className: 'bg-orange-500/10 text-orange-700 border-orange-200' },
  aberta: { label: 'Aberta', className: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  paga_total: { label: 'Paga Total', className: 'bg-green-500/10 text-green-700 border-green-200' },
  // Categorias do extrato bancário
  recebimento: { label: 'Recebimento', className: 'bg-green-500/10 text-green-700 border-green-200' },
  fornecedor: { label: 'Fornecedor', className: 'bg-red-500/10 text-red-700 border-red-200' },
  pessoal: { label: 'Folha Pgto', className: 'bg-purple-500/10 text-purple-700 border-purple-200' },
  pro_labore: { label: 'Pró-labore', className: 'bg-purple-500/10 text-purple-700 border-purple-200' },
  tributo: { label: 'Tributo', className: 'bg-orange-500/10 text-orange-700 border-orange-200' },
  despesa_operacional: { label: 'Despesa Operacional', className: 'bg-yellow-500/10 text-yellow-700 border-yellow-200' },
  financeiro: { label: 'Financeiro', className: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  saque: { label: 'Saque', className: 'bg-slate-500/10 text-slate-700 border-slate-200' },
  obras_reforma: { label: 'Obras/Reforma', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  transferencia: { label: 'Transferência', className: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  interno: { label: 'Interno', className: 'bg-slate-500/10 text-slate-700 border-slate-200' },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, className: 'bg-slate-500/10 text-slate-700 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.className}`}>
      {config.label}
    </span>
  );
}