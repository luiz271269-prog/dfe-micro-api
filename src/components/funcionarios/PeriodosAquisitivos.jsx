import { calcularPeriodosAquisitivos, PERIODO_STATUS_CONFIG } from '@/lib/feriasEngine';
import { formatCurrency, formatDate } from '@/lib/formatters';

// Detalhe dos períodos aquisitivos de um funcionário (últimos 4, incluindo o em curso):
// direito de 30 dias/ano, dias usados, retroativas vencidas e data/valor de pagamento.
export default function PeriodosAquisitivos({ func, ferias }) {
  const periodos = calcularPeriodosAquisitivos(func, ferias).slice(-4).reverse();
  if (periodos.length === 0) return <p className="text-xs text-muted-foreground py-2">Sem data de admissão cadastrada.</p>;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Períodos Aquisitivos (30 dias/ano)</p>
      {periodos.map((p) => {
        const sc = PERIODO_STATUS_CONFIG[p.status] || PERIODO_STATUS_CONFIG.em_curso;
        return (
          <div key={p.inicio} className={`rounded-lg border px-3 py-2 text-xs ${p.status === 'vencido' ? 'border-red-300 bg-red-50/50' : 'bg-card'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{formatDate(p.inicio)} → {formatDate(p.fim)}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${sc.color}`}>{sc.label}</span>
              {p.emCurso ? (
                <span className="text-muted-foreground">Proporcional até hoje: <b>{p.diasProporcionais} dias</b></span>
              ) : (
                <>
                  <span className="text-muted-foreground">Usados: <b>{p.diasUsados}/30</b></span>
                  {p.saldo > 0 && <span className={p.status === 'vencido' ? 'text-red-700 font-bold' : 'text-orange-600 font-semibold'}>Saldo: {p.saldo} dias</span>}
                  {p.limiteConcessivo && <span className="text-muted-foreground">Limite: {formatDate(p.limiteConcessivo)}</span>}
                </>
              )}
            </div>
            {p.pagamentos.length > 0 && (
              <div className="mt-1.5 space-y-0.5 pl-2 border-l-2 border-muted">
                {p.pagamentos.map((pg, i) => (
                  <p key={i} className="text-muted-foreground">
                    • {pg.dias} dias — gozo {formatDate(pg.inicio_gozo)} → {formatDate(pg.fim_gozo)}
                    {pg.abono && ' (inclui abono)'}
                    {pg.data_pagamento
                      ? <> · pago em <b className="text-green-700">{formatDate(pg.data_pagamento)}</b>{pg.valor_pago ? ` (${formatCurrency(pg.valor_pago)})` : ''}</>
                      : ' · sem data de pagamento registrada'}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}