import { FileImage } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

// Gradiente + logomarca real por bandeira/banco
const BANDEIRAS = {
  Sicoob: { gradient: 'from-teal-600 to-teal-800', logo: 'https://logo.clearbit.com/sicoob.com.br' },
  Sicredi: { gradient: 'from-green-500 to-green-700', logo: 'https://logo.clearbit.com/sicredi.com.br' },
  Acentra: { gradient: 'from-orange-400 to-orange-600', logo: 'https://logo.clearbit.com/acentra.coop.br' },
  Magalu: { gradient: 'from-blue-500 to-blue-700', logo: 'https://logo.clearbit.com/magazineluiza.com.br' },
  default: { gradient: 'from-slate-500 to-slate-700', logo: null }
};

const STATUS_PILL = {
  aberta: { label: 'Aberta', cls: 'bg-teal-50 text-teal-800' },
  paga_total: { label: 'Paga', cls: 'bg-green-100 text-green-800' },
  vencida: { label: 'Vencida', cls: 'bg-red-100 text-red-700' }
};

export default function CartaoCalendarioCard({ cartao, latestFat, fileUrl, faturasCount, isExpanded, onToggle, onViewFile }) {
  const c = cartao;
  const b = BANDEIRAS[c.bandeira] || BANDEIRAS.default;
  const pill = latestFat ? STATUS_PILL[latestFat.status] : null;
  const isImg = fileUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(fileUrl);

  return (
    <button
      onClick={onToggle}
      className={`group relative w-full text-left rounded-xl overflow-hidden bg-gradient-to-br px-10 ${b.gradient} shadow-md hover:shadow-lg transition-all ${isExpanded ? 'ring-2 ring-primary ring-offset-2' : ''}`}>

      {/* Topo compacto: dia + logo real do banco + tipo */}
      <div className="px-3 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-b from-white to-slate-200 border border-white/60 shadow flex flex-col items-center justify-center shrink-0 leading-none">
              <span className="text-[11px] font-extrabold text-slate-800">{c.dia_vencimento}</span>
              <span className="text-[7px] font-medium text-slate-600 -mt-0.5">dia</span>
            </div>
            <p className="text-xs font-bold text-white leading-tight truncate" title={c.nome}>{c.nome}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white/25 text-white">
              {c.tipo === 'empresarial' ? 'Emp' : 'Pess'}
            </span>
            {b.logo ?
            <span className="h-7 w-7 rounded-md bg-white p-0.5 flex items-center justify-center shadow" title={c.bandeira}>
                <img src={b.logo} alt={c.bandeira} className="max-h-full max-w-full object-contain rounded-sm" />
              </span> :
            <span className="text-xs font-extrabold text-white">{c.bandeira || '—'}</span>
            }
          </div>
        </div>
      </div>

      {/* Base: status, valor e vencimento */}
      <div className="bg-black/15 px-3 pt-1.5 pb-2 mt-2">
        {latestFat ?
        <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-extrabold text-white tracking-tight tabular-nums whitespace-nowrap">
                {formatCurrency(latestFat.valor_total)}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                {pill && <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${pill.cls}`}>{pill.label}</span>}
                {fileUrl &&
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {e.stopPropagation();onViewFile({ url: fileUrl, titulo: `${c.nome} — ${latestFat?.mes_referencia}` });}}
                className="w-9 h-11 rounded bg-white shadow overflow-hidden flex items-center justify-center hover:scale-105 transition-transform"
                title="Ver fatura original">
                    {isImg ? <img src={fileUrl} alt="" className="w-full h-full object-cover" /> : <FileImage className="w-3.5 h-3.5 text-slate-400" />}
                  </span>
              }
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-[10px] text-white/80 tabular-nums">Venc. {formatDate(latestFat.data_vencimento)}</span>
              <span className="text-[10px] text-white/80">{latestFat.mes_referencia} · {faturasCount} fat.</span>
            </div>
          </> :

        <p className="text-[11px] text-white/90 font-medium py-1">Sem fatura · vence dia {c.dia_vencimento}</p>
        }
      </div>
    </button>);

}