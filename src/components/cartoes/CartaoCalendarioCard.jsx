import { FileImage } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

// Gradiente + logomarca real por bandeira/banco
const BANDEIRAS = {
  Sicoob: { gradient: 'from-teal-600 to-teal-800', logo: 'https://logo.clearbit.com/sicoob.com.br' },
  Sicredi: { gradient: 'from-green-500 to-green-700', logo: 'https://logo.clearbit.com/sicredi.com.br' },
  Acentra: { gradient: 'from-orange-400 to-orange-600', logo: 'https://logo.clearbit.com/acentra.coop.br' },
  Magalu: { gradient: 'from-blue-500 to-blue-700', logo: 'https://logo.clearbit.com/magazineluiza.com.br' },
  default: { gradient: 'from-slate-500 to-slate-700', logo: null },
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
      className={`group relative w-full max-w-[420px] text-left rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all flex aspect-[1.586/1] ${isExpanded ? 'ring-2 ring-primary ring-offset-2' : ''}`}>

      {/* Painel esquerdo (70%): gradiente do banco com dados empilhados */}
      <div className={`w-[70%] bg-gradient-to-br ${b.gradient} p-4 flex flex-col min-w-0`}>
        <p className="text-sm font-semibold text-white/90">{c.dia_vencimento} dia</p>
        <p className="text-base font-bold text-white leading-tight truncate" title={c.nome}>{c.nome}</p>
        <span className="mt-1.5 self-start text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white text-slate-700">
          {c.tipo === 'empresarial' ? 'Emp' : 'Pess'}
        </span>
        <div className="flex-1" />
        {latestFat ? (
          <>
            <p className="text-2xl font-extrabold text-white tracking-tight tabular-nums whitespace-nowrap">
              {formatCurrency(latestFat.valor_total)}
            </p>
            {pill && <span className={`mt-1 self-start text-[10px] font-bold px-2.5 py-0.5 rounded-full ${pill.cls}`}>{pill.label}</span>}
            <p className="text-xs text-white/90 tabular-nums mt-1">Venc. {formatDate(latestFat.data_vencimento)}</p>
            <p className="text-xs text-white/80">{latestFat.mes_referencia} · {faturasCount} fat.</p>
          </>
        ) : (
          <p className="text-sm text-white/90 font-medium">Sem fatura · vence dia {c.dia_vencimento}</p>
        )}
      </div>

      {/* Painel direito (30%): miniatura da fatura + logo do banco */}
      <div className="w-[30%] bg-slate-50 p-3 flex flex-col items-center justify-between gap-2">
        {fileUrl ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {e.stopPropagation();onViewFile({ url: fileUrl, titulo: `${c.nome} — ${latestFat?.mes_referencia}` });}}
            className="w-full flex-1 min-h-0 rounded-lg bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center hover:scale-105 transition-transform"
            title="Ver fatura original">
            {isImg ? <img src={fileUrl} alt="Fatura" className="w-full h-full object-cover" /> : <FileImage className="w-7 h-7 text-slate-400" />}
          </span>
        ) : (
          <span className="w-full flex-1 min-h-0 rounded-lg bg-white border border-dashed border-slate-200 flex items-center justify-center">
            <FileImage className="w-7 h-7 text-slate-300" />
          </span>
        )}
        <span className="flex items-center gap-1.5 shrink-0">
          {b.logo &&
            <img
              src={b.logo}
              alt=""
              className="h-6 w-6 object-contain"
              onError={(e) => {e.currentTarget.style.display = 'none';}} />
          }
          <span className="text-xs font-extrabold text-slate-700">{c.bandeira || '—'}</span>
        </span>
      </div>
    </button>);

}