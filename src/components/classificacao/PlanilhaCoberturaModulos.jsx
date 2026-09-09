import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { tipoGastoValido, exigeTipoGasto } from '@/lib/classificacaoUnificada';

const MODULOS = [
  { entidade: 'LancamentoBancario', label: 'Extrato Bancário' },
  { entidade: 'LancamentoCartao', label: 'Cartões (lançamentos)' },

  { entidade: 'DespesaOperacional', label: 'Despesas Operacionais' },
  { entidade: 'Tributo', label: 'Tributos' },
  { entidade: 'ObraReforma', label: 'Obras / Reformas' },
  { entidade: 'ItemCompra', label: 'Compras (itens)' },
  { entidade: 'FolhaPagamento', label: 'Folha de Pagamento' },
  { entidade: 'RegraRecorrente', label: 'Recorrentes' },
  { entidade: 'VinculoExtrato', label: 'Vínculos (fonte da verdade)' },
];

function Pct({ n, total }) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  const cor = pct >= 99 ? 'text-green-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600';
  return (
    <span className="tabular-nums">
      <span className="font-semibold">{n}</span>
      <span className={`ml-1.5 text-xs font-bold ${cor}`}>{pct}%</span>
    </span>
  );
}

// Planilha lado a lado: cobertura da classificação unificada (origem_compra / tipo_compra) por módulo
export default function PlanilhaCoberturaModulos() {
  const [linhas, setLinhas] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(v => v + 1);
    window.addEventListener('neuralfinRefresh', refresh);
    return () => window.removeEventListener('neuralfinRefresh', refresh);
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const resultados = await Promise.all(
        MODULOS.map(async (m) => {
          const regs = await base44.entities[m.entidade].list(null, 10000);
          const lista = (Array.isArray(regs) ? regs : []).filter(r => exigeTipoGasto(m.entidade, r));
          const comOrigem = lista.filter((r) => r.origem_compra).length;
          const comTipo = lista.filter((r) => tipoGastoValido(r.tipo_compra)).length;
          return { ...m, total: lista.length, comOrigem, comTipo };
        })
      );
      if (ativo) setLinhas(resultados);
    })();
    return () => { ativo = false; };
  }, [revision]);

  if (!linhas) {
    return <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">Auditando cobertura por módulo…</div>;
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-muted/60 to-muted/30">
        <p className="text-sm font-bold">Padronização por Módulo — Planilha Lado a Lado</p>
        <p className="text-xs text-muted-foreground">Cobertura dos eixos unificados "Quem comprou" e "Tipo de gasto" (seis tipos válidos) em cada entidade de saída</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left px-4 py-2 font-semibold">Módulo</th>
              <th className="text-right px-4 py-2 font-semibold">Registros</th>
              <th className="text-right px-4 py-2 font-semibold">Quem comprou</th>
              <th className="text-right px-4 py-2 font-semibold">Tipo de gasto</th>
              <th className="text-center px-4 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const ok = l.total === 0 || (l.comOrigem / l.total >= 0.99 && l.comTipo / l.total >= 0.99);
              return (
                <tr key={l.entidade} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{l.label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{l.total}</td>
                  <td className="px-4 py-2.5 text-right"><Pct n={l.comOrigem} total={l.total} /></td>
                  <td className="px-4 py-2.5 text-right"><Pct n={l.comTipo} total={l.total} /></td>
                  <td className="px-4 py-2.5 text-center">
                    {ok ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Padronizado</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> Lacunas</span>
                    )}
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