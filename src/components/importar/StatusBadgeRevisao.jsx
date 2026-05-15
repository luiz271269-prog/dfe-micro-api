export default function StatusBadge({ status }) {
  const map = {
    novo: 'bg-green-100 text-green-700',
    duplicata: 'bg-yellow-100 text-yellow-700',
    erro: 'bg-red-100 text-red-700',
    pago: 'bg-green-100 text-green-700',
    parcial: 'bg-blue-100 text-blue-700',
    a_vencer: 'bg-slate-100 text-slate-600',
    em_aberto: 'bg-slate-100 text-slate-600',
    vencido: 'bg-red-100 text-red-700',
  };
  const labels = {
    novo: 'NOVO', duplicata: 'DUP', erro: 'ERRO',
    pago: 'pago', parcial: 'parcial', a_vencer: 'a vencer',
    em_aberto: 'aberto', vencido: 'vencido',
  };
  return <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{labels[status] || status}</span>;
}