import { CreditCard, FileImage } from 'lucide-react';
import StatusBadge from '../shared/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/formatters';

// Estilo por bandeira/banco — cor própria de cada instituição
const BANDEIRAS = {
  Sicoob:  { bar: 'bg-teal-700',    icon: 'bg-teal-700 text-white',    badge: 'bg-teal-100 text-teal-800',     nameText: 'text-teal-800',   ring: 'border-teal-300 text-teal-800 bg-teal-50' },
  Sicredi: { bar: 'bg-green-600',   icon: 'bg-green-600 text-white',   badge: 'bg-green-100 text-green-800',   nameText: 'text-green-700',  ring: 'border-green-300 text-green-800 bg-green-50' },
  Acentra: { bar: 'bg-orange-500',  icon: 'bg-orange-500 text-white',  badge: 'bg-orange-100 text-orange-800', nameText: 'text-orange-700', ring: 'border-orange-300 text-orange-800 bg-orange-50' },
  Magalu:  { bar: 'bg-blue-600',    icon: 'bg-blue-600 text-white',    badge: 'bg-blue-100 text-blue-800',     nameText: 'text-blue-700',   ring: 'border-blue-300 text-blue-800 bg-blue-50' },
  default: { bar: 'bg-slate-500',   icon: 'bg-slate-600 text-white',   badge: 'bg-slate-100 text-slate-700',   nameText: 'text-slate-800',  ring: 'border-slate-200 text-slate-600 bg-slate-100' },
};

const STATUS_COLORS = {
  aberta: 'bg-amber-100 border-amber-300 text-amber-800',
  paga_total: 'bg-green-100 border-green-300 text-green-800',
  vencida: 'bg-red-100 border-red-300 text-red-800',
};

// Uma coluna do calendário: círculo do dia de vencimento no topo + card do cartão logo abaixo.
export default function CartaoCalendarioCard({ cartao, latestFat, fileUrl, faturasCount, isExpanded, onToggle, onViewFile }) {
  const c = cartao;
  const bStyle = BANDEIRAS[c.bandeira] || BANDEIRAS.default;
  const circleCls = latestFat ? (STATUS_COLORS[latestFat.status] || 'bg-blue-100 border-blue-300 text-blue-800') : 'bg-slate-100 border-slate-200 text-slate-600';
  const isImg = fileUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(fileUrl);

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Círculo do dia — topo do tópico */}
      <button
        onClick={onToggle}
        className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center transition-all hover:scale-105 ${circleCls}`}
      >
        <span className="text-lg font-bold leading-none">{c.dia_vencimento}</span>
        <span className="text-[9px] font-medium">dia</span>
      </button>

      {/* Card do cartão — logo abaixo do círculo */}
      <button
        onClick={onToggle}
        className={`group relative w-full bg-gradient-to-br from-card to-muted/20 rounded-xl border p-2.5 hover:shadow-md hover:border-primary/40 transition-all text-left overflow-hidden ${isExpanded ? 'ring-2 ring-primary border-primary shadow-md' : ''}`}
      >
        <div className={`absolute top-0 left-0 right-0 h-1 ${bStyle.bar}`} />
        <div className="flex items-center gap-1.5 mb-1.5 mt-0.5">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 shadow-sm ${bStyle.icon}`}>
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${bStyle.badge}`}>
            {c.bandeira || '—'}
          </span>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ml-auto ${c.tipo === 'empresarial' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
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
        <p className={`text-[11px] font-bold leading-tight truncate ${bStyle.nameText}`} title={c.nome}>{c.nome}</p>
        {latestFat ? (
          <div className="pt-1.5 mt-1.5 border-t border-dashed">
            <p className="text-sm font-extrabold tracking-tight tabular-nums truncate text-foreground">{formatCurrency(latestFat.valor_total)}</p>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <span className="text-[10px] text-muted-foreground tabular-nums">Venc. {formatDate(latestFat.data_vencimento)}</span>
              <StatusBadge status={latestFat.status} />
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">{latestFat.mes_referencia} · {faturasCount} fatura(s)</p>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground pt-1.5 mt-1.5 border-t border-dashed italic">Sem fatura · vence dia {c.dia_vencimento}</p>
        )}
      </button>
    </div>
  );
}