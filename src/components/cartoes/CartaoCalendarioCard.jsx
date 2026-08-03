import { FileImage } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

// Gradiente realista por bandeira/banco — cor própria de cada instituição
const BANDEIRAS = {
  Sicoob: 'from-teal-600 to-teal-800',
  Sicredi: 'from-green-500 to-green-700',
  Acentra: 'from-orange-400 to-orange-600',
  Magalu: 'from-blue-500 to-blue-700',
  default: 'from-slate-500 to-slate-700',
};

// Pill de status clara sobre o gradiente
const STATUS_PILL = {
  aberta: { label: 'Aberta', cls: 'bg-teal-50 text-teal-800' },
  paga_total: { label: 'Paga', cls: 'bg-green-100 text-green-800' },
  vencida: { label: 'Vencida', cls: 'bg-red-100 text-red-700' },
};

export default function CartaoCalendarioCard({ cartao, latestFat, fileUrl, faturasCount, isExpanded, onToggle, onViewFile }) {
  const c = cartao;
  const gradient = BANDEIRAS[c.bandeira] || BANDEIRAS.default;
  const pill = latestFat ? STATUS_PILL[latestFat.status] : null;
  const isImg = fileUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(fileUrl);

  return (
    <button
      onClick={onToggle}
      className={`group relative w-full text-left rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} shadow-md hover:shadow-lg transition-all ${isExpanded ? 'ring-2 ring-primary ring-offset-2' : ''}`}>

      {/* Topo: chip do dia + bandeira/tipo */}
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="w-11 h-11 rounded-full bg-gradient-to-b from-white to-slate-200 border border-white/60 shadow flex flex-col items-center justify-center shrink-0 leading-none">
            <span className="text-sm font-extrabold text-slate-800">{c.dia_vencimento}</span>
            <span className="text-[8px] font-medium text-slate-600 -mt-0.5">dia</span>
          </div>
          <div className="flex flex-col items-end gap-1.5 min-w-0">
            <span className="text-sm font-extrabold text-white tracking-tight truncate">{c.bandeira || '—'}</span>
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white/25 text-white">
              {c.tipo === 'empresarial' ? 'Emp' : 'Pess'}
            </span>
          </div>
        </div>

        {/* Nome do cartão + miniatura da fatura */}
        <div className="flex items-end justify-between gap-2 mt-3 mb-3">
          <p className="text-base font-bold text-white leading-snug" title={c.nome}>{c.nome}</p>
          {fileUrl &&
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {e.stopPropagation();onViewFile({ url: fileUrl, titulo: `${c.nome} — ${latestFat?.mes_referencia}` });}}
              className="w-12 h-14 rounded-md bg-white shadow-md overflow-hidden flex items-center justify-center shrink-0 hover:scale-105 transition-transform -mb-6 relative z-10"
              title="Ver fatura original">
              {isImg ? <img src={fileUrl} alt="" className="w-full h-full object-cover" /> : <FileImage className="w-4 h-4 text-slate-400" />}
            </span>
          }
        </div>
      </div>

      {/* Base: painel escurecido com status, valor e vencimento */}
      <div className="bg-black/15 px-4 pt-3 pb-3.5">
        {latestFat ? (
          <>
            {pill &&
              <div className="flex justify-end">
                <span className={`text-[11px] font-bold px-3 py-0.5 rounded-full ${pill.cls}`}>{pill.label}</span>
              </div>
            }
            <p className="text-2xl font-extrabold text-white tracking-tight tabular-nums mt-1 truncate">
              {formatCurrency(latestFat.valor_total)}
            </p>
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <span className="text-[11px] text-white/80 tabular-nums">Venc. {formatDate(latestFat.data_vencimento)}</span>
              <span className="text-[11px] text-white/80">{latestFat.mes_referencia} · {faturasCount} fat.</span>
            </div>
          </>
        ) : (
          <>
            <p className="text-[12px] text-white/90 font-medium">Sem fatura · vence dia {c.dia_vencimento}</p>
            <div className="h-7 rounded-lg bg-white/20 mt-2" />
            <p className="text-[11px] text-white/70 mt-1.5">—</p>
          </>
        )}
      </div>
    </button>);

}