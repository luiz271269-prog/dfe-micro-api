import { FileImage } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

// Gradiente + logomarca real por bandeira/banco
const BANDEIRAS = {
  Sicoob: { gradient: 'from-teal-600 to-teal-800', logo: 'https://logo.clearbit.com/sicoob.com.br', text: 'text-teal-700', dot: 'bg-teal-600' },
  Sicredi: { gradient: 'from-green-500 to-green-700', logo: 'https://logo.clearbit.com/sicredi.com.br', text: 'text-green-700', dot: 'bg-green-600' },
  Acentra: { gradient: 'from-orange-400 to-orange-600', logo: 'https://logo.clearbit.com/acentra.coop.br', text: 'text-orange-600', dot: 'bg-orange-500' },
  Magalu: { gradient: 'from-blue-500 to-blue-700', logo: 'https://logo.clearbit.com/magazineluiza.com.br', text: 'text-blue-700', dot: 'bg-blue-600' },
  default: { gradient: 'from-slate-500 to-slate-700', logo: null, text: 'text-slate-700', dot: 'bg-slate-500' },
};

const STATUS_PILL = {
  aberta: { label: 'Aberta', cls: 'bg-white/25 text-white' },
  paga_total: { label: 'Paga', cls: 'bg-green-100 text-green-800' },
  vencida: { label: 'Vencida', cls: 'bg-red-100 text-red-700' },
};

export default function CartaoCalendarioCard({ cartao, latestFat, fileUrl, faturasCount, isExpanded, onToggle, onViewFile }) {
  const c = cartao;
  const b = BANDEIRAS[c.bandeira] || BANDEIRAS.default;
  const pill = latestFat ? STATUS_PILL[latestFat.status] : null;
  const isImg = fileUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(fileUrl);

  return (
    <button
      onClick={onToggle}
      className={`group relative w-[227px] h-[113px] shrink-0 text-left rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all flex items-stretch ${isExpanded ? 'ring-2 ring-primary ring-offset-2' : ''}`}>

      {/* Painel esquerdo (70%): gradiente da instituição com os dados */}
      <div className={`w-[70%] bg-gradient-to-br ${b.gradient} px-2.5 py-2 flex flex-col min-w-0`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 flex items-baseline gap-0.5 rounded-md border border-white/70 bg-white/15 px-1.5 py-0.5 leading-none">
            <span className="text-[8px] font-semibold text-white/80">dia</span>
            <span className="text-[14px] font-extrabold text-white tabular-nums">{c.dia_vencimento}</span>
          </span>
          <span className="text-[8px] font-bold px-1.5 py-px rounded-full bg-white/90 text-slate-700 leading-tight shrink-0">
            {c.tipo === 'empresarial' ? 'Emp' : 'Pess'}
          </span>
        </div>
        <p className="text-[11px] font-bold text-white leading-tight truncate mt-0.5" title={c.nome}>{c.nome}</p>
        <div className="flex-1" />
        {latestFat ? (
          <>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <p className="text-[15px] font-extrabold text-white tracking-tight tabular-nums whitespace-nowrap leading-none">
                {formatCurrency(latestFat.valor_total)}
              </p>
              {pill && <span className={`text-[8px] font-bold px-1.5 py-px rounded-full leading-tight shrink-0 ${pill.cls}`}>{pill.label}</span>}
            </div>
            <p className="text-[9px] text-white/90 tabular-nums mt-1 leading-tight truncate">
              Venc. {formatDate(latestFat.data_vencimento)} · {latestFat.mes_referencia} · {faturasCount} fat.
            </p>
          </>
        ) : (
          <p className="text-[10px] text-white/90 font-medium">Sem fatura · vence dia {c.dia_vencimento}</p>
        )}
      </div>

      {/* Painel direito (30%): miniatura da fatura + bandeira */}
      <div className="w-[30%] bg-white p-1.5 flex flex-col items-center justify-between gap-1">
        {fileUrl ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {e.stopPropagation();onViewFile({ url: fileUrl, titulo: `${c.nome} — ${latestFat?.mes_referencia}` });}}
            className="w-full flex-1 min-h-0 rounded-lg bg-white border border-slate-300 shadow-sm overflow-hidden flex items-center justify-center hover:scale-105 transition-transform"
            title="Ver fatura original">
            {isImg ? <img src={fileUrl} alt="Fatura" className="w-full h-full object-cover" /> : <FileImage className="w-4 h-4 text-slate-400" />}
          </span>
        ) : (
          <span className="w-full flex-1 min-h-0 rounded-md bg-white border border-dashed border-slate-200 flex items-center justify-center">
            <FileImage className="w-4 h-4 text-slate-300" />
          </span>
        )}
        <span className="flex items-center gap-1 shrink-0">
          {b.logo ?
            <img
              src={b.logo}
              alt=""
              className="h-4 w-4 rounded-full object-contain"
              onError={(e) => {e.currentTarget.outerHTML = '';}} /> :
            <span className={`h-2 w-2 rounded-full ${b.dot}`} />
          }
          <span className={`text-[10px] font-extrabold ${b.text}`}>{c.bandeira || '—'}</span>
        </span>
      </div>
    </button>);

}