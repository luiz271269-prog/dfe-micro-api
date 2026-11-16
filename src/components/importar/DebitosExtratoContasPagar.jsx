import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ehSaidaContasPagar } from '@/lib/extratoNatureza';
import { carregarObrigacoesAbertas } from '@/lib/obrigacoesAbertas';
import { compararDebitosComContas } from '@/lib/debitosExtratoMatch';
import { formatCurrency } from '@/lib/formatters';
import AnalisarPagtosExtratoDialog from '@/components/contas-pagar/AnalisarPagtosExtratoDialog';
import DebitoExtratoLinha from '@/components/importar/DebitoExtratoLinha';

const GRUPOS = [
  { id: 'provaveis', titulo: 'Já cadastrados no Contas a Pagar · correspondência provável', faixa: 'bg-emerald-50 text-emerald-800' },
  { id: 'possiveis', titulo: 'Correspondência possível · conferir', faixa: 'bg-amber-50 text-amber-800' },
  { id: 'semPar', titulo: 'Sem conta cadastrada', faixa: 'bg-slate-100 text-slate-700' },
];
const total = linhas => linhas.reduce((s, l) => s + Math.abs(l.debito.valor || 0), 0);

export default function DebitosExtratoContasPagar({ batchId }) {
  const [conferir, setConferir] = useState(null);
  const q = useQuery({
    queryKey: ['debitos-extrato-contas', batchId],
    queryFn: async () => {
      const [lancs, obrigacoes] = await Promise.all([
        base44.entities.LancamentoBancario.filter({ import_batch_id: batchId }, '-data', 2000),
        carregarObrigacoesAbertas(),
      ]);
      const debitos = lancs.filter(ehSaidaContasPagar);
      return {
        obrigacoes,
        conciliados: debitos.filter(l => l.status_conciliacao === 'conciliado').length,
        pendentes: debitos.filter(l => !['conciliado', 'ignorar'].includes(l.status_conciliacao)),
      };
    },
  });
  const grupos = useMemo(() => q.data ? compararDebitosComContas(q.data.pendentes, q.data.obrigacoes) : null, [q.data]);

  return (
    <section aria-label="Débitos do extrato comparados com Contas a Pagar" className="overflow-hidden rounded-xl border bg-card">
      <header className="border-b px-4 py-3">
        <h3 className="font-semibold">Débitos deste extrato × Contas a Pagar</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Comparação por valor, data e descrição/fornecedor. Nada é baixado automaticamente: cada correspondência precisa da sua confirmação.</p>
      </header>
      {q.isLoading ? <p className="p-4 text-sm text-muted-foreground">Analisando os débitos importados…</p>
        : q.isError ? <p role="alert" className="p-4 text-sm text-destructive">{q.error.message}</p>
        : !q.data.pendentes.length ? <p className="p-4 text-sm text-muted-foreground">Nenhum débito pendente neste extrato{q.data.conciliados ? ` · ${q.data.conciliados} já conciliado(s)` : ''}.</p>
        : <>
          {q.data.conciliados > 0 && <p className="border-b px-4 py-2 text-xs text-muted-foreground">{q.data.conciliados} débito(s) deste extrato já estavam conciliados e não aparecem abaixo.</p>}
          {GRUPOS.filter(g => grupos[g.id].length).map(g => (
            <div key={g.id}>
              <div className={`flex items-center justify-between px-4 py-1.5 text-xs font-semibold ${g.faixa}`}>
                <span>{g.titulo}</span>
                <span className="tabular-nums">{formatCurrency(total(grupos[g.id]))} · {grupos[g.id].length}</span>
              </div>
              <ul className="divide-y">
                {grupos[g.id].map(l => <DebitoExtratoLinha key={l.debito.id} linha={l} onConferir={setConferir} />)}
              </ul>
            </div>
          ))}
        </>}
      {conferir && <AnalisarPagtosExtratoDialog open lancamentoIdInicial={conferir.id} onClose={() => setConferir(null)} onResolved={() => q.refetch()} />}
    </section>
  );
}