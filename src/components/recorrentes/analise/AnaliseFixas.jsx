import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import AnaliseFixaLinha from '@/components/recorrentes/analise/AnaliseFixaLinha';
import AnaliseFixasRegra from '@/components/recorrentes/analise/AnaliseFixasRegra';
import useFixasAnalise from '@/components/recorrentes/analise/useFixasAnalise';
import useRevelarLinhas from '@/components/recorrentes/analise/useRevelarLinhas';

const BASES = [['previsto', 'Previsto no cadastro'], ['pago', 'Pago no extrato e cartão']];
const rotuloMes = m => `${m.slice(5)}/${m.slice(0, 4)}`;

export default function AnaliseFixas({ mes }) {
  const [aberto, setAberto] = useState(false);
  const [base, setBase] = useState('previsto');
  const [todas, setTodas] = useState(false);
  const [regra, setRegra] = useState(false);
  const { data, isPending, error, refetch } = useFixasAnalise(mes, aberto);
  const itens = useMemo(() => [...(data?.itens || [])].sort((a, b) => b[base].media_mensal - a[base].media_mensal), [data, base]);
  const visiveis = todas ? itens : itens.slice(0, 12);
  const lista = useRef(null);
  useRevelarLinhas(lista, `${mes}-${base}-${visiveis.length}`);
  const t = data?.totais;
  return (
    <section className="mb-4 overflow-hidden rounded-xl border bg-card">
      <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
        {aberto ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div>
          <h2 className="font-semibold">Análise dos últimos 12 meses</h2>
          <p className="text-xs text-muted-foreground">Origem de cada despesa fixa, valor médio mensal e participação no total.</p>
        </div>
      </button>
      {aberto && <div className="space-y-4 border-t p-4">
        {isPending && <p role="status" className="text-sm text-muted-foreground">Calculando a análise dos últimos 12 meses...</p>}
        {error && <div role="alert" className="text-sm text-destructive"><p>{error.message}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Tentar novamente</Button></div>}
        {data && <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Período</dt><dd className="font-semibold">{rotuloMes(data.periodo.inicio)} a {rotuloMes(data.periodo.fim)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Previsto por mês (cadastro)</dt><dd className="font-semibold tabular-nums">{formatCurrency(t.previsto_mensal)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Pago por mês (identificado)</dt><dd className="font-semibold tabular-nums">{formatCurrency(t.pago_mensal)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Conciliado no período</dt><dd className="font-semibold tabular-nums">{formatCurrency(t.conciliado_total)}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {BASES.map(([k, r]) => <Button key={k} size="sm" variant={base === k ? 'default' : 'outline'} onClick={() => setBase(k)}>{r}</Button>)}
              <Button size="sm" variant="ghost" onClick={() => setRegra(!regra)}>{regra ? 'Ocultar regra' : 'Regra de cálculo'}</Button>
            </div>
          </div>
          {t.sem_pagamento > 0 && <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">{t.sem_pagamento} de {t.itens} despesa(s) fixa(s) não têm pagamento identificado no extrato ou cartão neste período. A previsão do cadastro não é tratada como pagamento.</p>}
          {regra && <AnaliseFixasRegra />}
          {!itens.length ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma despesa fixa cadastrada para analisar.</p>
            : <ol ref={lista} className="w-full max-w-4xl list-none">{visiveis.map((item, i) => <AnaliseFixaLinha key={item.id} item={item} base={base} primeira={i === 0} />)}</ol>}
          {itens.length > 12 && <Button variant="outline" size="sm" onClick={() => setTodas(!todas)}>{todas ? 'Mostrar as 12 maiores' : `Mostrar todas (${itens.length})`}</Button>}
        </>}
      </div>}
    </section>
  );
}