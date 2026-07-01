import { FileImage } from 'lucide-react';
import StatusBadge from '../shared/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/formatters';

// Estilo por bandeira/banco — cor própria de cada instituição
const BANDEIRAS = {
  Sicoob:  { bar: 'bg-teal-700',    icon: 'bg-teal-700 text-white',    badge: 'bg-teal-100 text-teal-800',     nameText: 'text-teal-800' },
  Sicredi: { bar: 'bg-green-600',   icon: 'bg-green-600 text-white',   badge: 'bg-green-100 text-green-800',   nameText: 'text-green-700' },
  Acentra: { bar: 'bg-orange-500',  icon: 'bg-orange-500 text-white',  badge: 'bg-orange-100 text-orange-800', nameText: 'text-orange-700' },
  Magalu:  { bar: 'bg-blue-600',    icon: 'bg-blue-600 text-white',    badge: 'bg-blue-100 text-blue-800',     nameText: 'text-blue-700' },
  default: { bar: 'bg-slate-500',   icon: 'bg-slate-600 text-white',   badge: 'bg-slate-100 text-slate-700',   nameText: 'text-slate-800' },
};

// Cor do círculo do dia conforme status da fatura
const DIA_COLORS = {
  aberta: 'bg-amber-100 border-amber-300 text-amber-800',
  paga_total: 'bg-green-100 border-green-300 text-green-800',
  vencida: 'bg-red-100 border-red-300 text-red-800',
};

export default function CartaoCalendarioCard({ cartao, latestFat, fileUrl, faturasCount, isExpanded, onToggle, onViewFile }) {
  const c = cartao;
  const bStyle = BANDEIRAS[c.bandeira] || BANDEIRAS.default;
  const diaCls = latestFat ? (DIA_COLORS[latestFat.status] || 'bg-blue-100 border-blue-300 text-blue-800') : 'bg-slate-100 border-slate-200 text-slate-600';
  const isImg = fileUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(fileUrl);

  return (
    <button
      onClick={onToggle}
      className={`group relative bg-gradient-to-br from-card to-muted/20 rounded-xl border p-2.5 hover:shadow-md hover:border-primary/40 transition-all text-left overflow-hidden ${isExpanded ? 'ring-2 ring-primary border-primary shadow-md' : ''}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 ${bStyle.bar}`} />

      {/* Topo: dia de vencimento (canto sup. esquerdo) + banco + tipo */}
      <div className="flex items-center gap-1.5 mb-1.5 mt-1">
        <div className={`w-9 h-9 rounded-full border-2 flex flex-col items-center justify-center shrink-0 leading-none ${diaCls}`}>
          <span className="text-sm font-bold">{c.dia_vencimento}</span>
          <span className="text-[7px] font-medium -mt-0.5">dia</span>
        </div>
        <div className="min-w-0 flex-1">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${bStyle.badge}`}>
            {c.bandeira || '—'}
          </span>
          <p className={`text-[11px] font-bold leading-tight truncate mt-0.5 ${bStyle.nameText}`} title={c.nome}>{c.nome}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${c.tipo === 'empresarial' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
            {c.tipo === 'empresarial' ? 'Emp' : 'Pess'}
          </span>
          {fileUrl && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onViewFile({ url: fileUrl, titulo: `${c.nome} — ${latestFat.mes_referencia}` }); }}
              className="w-5 h-5 rounded border border-blue-200 bg-blue-50 overflow-hidden flex items-center justify-center hover:border-blue-400"
              title="Ver fatura original"
            >
              {isImg ? <img src={fileUrl} alt="" className="w-full h-full object-cover" /> : <FileImage className="w-2.5 h-2.5 text-blue-600" />}
            </span>
          )}
        </div>
      </div>

      {/* Valor + vencimento + status */}
      {latestFat ? (
        <div className="pt-1.5 mt-1 border-t border-dashed">
          <div className="flex items-center justify-between gap-1">
            <p className="text-sm font-extrabold tracking-tight tabular-nums truncate text-foreground">{formatCurrency(latestFat.valor_total)}</p>
            <StatusBadge status={latestFat.status} />
          </div>
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <span className="text-[10px] text-muted-foreground tabular-nums">Venc. {formatDate(latestFat.data_vencimento)}</span>
            <span className="text-[9px] text-muted-foreground">{latestFat.mes_referencia} · {faturasCount} fat.</span>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground pt-1.5 mt-1 border-t border-dashed italic">Sem fatura · vence dia {c.dia_vencimento}</p>
      )}
    </button>
  );
}