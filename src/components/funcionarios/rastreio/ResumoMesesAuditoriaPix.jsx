import { formatCurrency, formatDate } from '@/lib/formatters';
import { Calendar, CheckCircle2, AlertTriangle, HelpCircle, FileWarning } from 'lucide-react';

const COBERTURA_BADGE = {
  completa: { label: 'Extrato completo', cls: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  parcial:  { label: 'Extrato parcial',  cls: 'bg-amber-100 text-amber-800', icon: AlertTriangle },
  ausente:  { label: 'Sem extrato no mês seg.', cls: 'bg-red-100 text-red-800', icon: FileWarning },
};

export default function ResumoMesesAuditoriaPix({ meses = [], competenciaFiltro, onSelectCompetencia }) {
  if (!meses.length) return null;

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">Cobertura e Diagnóstico Mensal — Últimos 12 Meses (Regra do 5º ao 7º Dia Útil do Mês Seguinte)</h3>
        </div>
        {competenciaFiltro && (
          <button
            onClick={() => onSelectCompetencia(null)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Mostrar todos os 12 meses ({competenciaFiltro} selecionado)
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/20 text-muted-foreground">
              <th className="text-left px-3 py-2 font-semibold">Competência</th>
              <th className="text-left px-3 py-2 font-semibold">Janela (5º–7º DU seg.)</th>
              <th className="text-left px-3 py-2 font-semibold">Cobertura Extrato</th>
              <th className="text-right px-3 py-2 font-semibold">Folhas</th>
              <th className="text-right px-3 py-2 font-semibold">Líquido Total</th>
              <th className="text-right px-3 py-2 font-semibold">PIX Confirmado</th>
              <th className="text-center px-2 py-2 font-semibold text-green-700">Corretos</th>
              <th className="text-center px-2 py-2 font-semibold text-sky-700">Candidatos</th>
              <th className="text-center px-2 py-2 font-semibold text-orange-700">Revisar</th>
              <th className="text-center px-2 py-2 font-semibold text-purple-700">Duplic.</th>
              <th className="text-center px-2 py-2 font-semibold text-red-700">S/ Evid.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {meses.map(m => {
              const cob = COBERTURA_BADGE[m.cobertura_extrato] || COBERTURA_BADGE.ausente;
              const Icon = cob.icon || HelpCircle;
              const ativo = competenciaFiltro === m.competencia;
              return (
                <tr
                  key={m.competencia}
                  onClick={() => onSelectCompetencia(ativo ? null : m.competencia)}
                  className={`cursor-pointer transition-colors hover:bg-muted/30 ${ativo ? 'bg-primary/5 font-semibold' : ''}`}
                >
                  <td className="px-3 py-2.5 font-mono font-bold text-foreground">{m.competencia}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {m.quinto_dia_util ? `${formatDate(m.quinto_dia_util)} a ${formatDate(m.setimo_dia_util)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${cob.cls}`}>
                      <Icon className="w-3 h-3" /> {cob.label}
                    </span>
                    {m.extrato_ate && <span className="ml-1.5 text-[10px] text-muted-foreground">(até {formatDate(m.extrato_ate)})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.total_folhas}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatCurrency(m.total_liquido)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-green-700 font-semibold">{formatCurrency(m.total_pix_confirmado)}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums">
                    {m.qtd_corretos > 0 ? <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-bold">{m.qtd_corretos}</span> : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums">
                    {m.qtd_candidatos > 0 ? <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold">{m.qtd_candidatos}</span> : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums">
                    {m.qtd_revisar > 0 ? <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-bold">{m.qtd_revisar}</span> : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums">
                    {m.qtd_duplicidades > 0 ? <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">{m.qtd_duplicidades}</span> : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums">
                    {m.qtd_sem_evidencia > 0 ? <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold">{m.qtd_sem_evidencia}</span> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}