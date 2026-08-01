import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import MonthNavigator from '@/components/shared/MonthNavigator';
import MatrizClassificacao from '@/components/classificacao/MatrizClassificacao';

export default function AnaliseClassificacao() {
  const [vinculos, setVinculos] = useState([]);
  const [lancs, setLancs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [anual, setAnual] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [v, l] = await Promise.all([
        base44.entities.VinculoExtrato.list('-created_date', 10000),
        base44.entities.LancamentoBancario.list('-data', 10000),
      ]);
      setVinculos(v || []);
      setLancs(l || []);
      setLoading(false);
    })();
  }, []);

  const dataPorLanc = useMemo(() => {
    const m = {};
    for (const l of lancs) m[l.id] = l.data || '';
    return m;
  }, [lancs]);

  const filtrados = useMemo(() => {
    const ano = mes.slice(0, 4);
    return vinculos.filter((v) => {
      const d = dataPorLanc[v.lancamento_bancario_id] || '';
      return anual ? d.startsWith(ano) : d.startsWith(mes);
    });
  }, [vinculos, dataPorLanc, mes, anual]);

  const semClass = filtrados.filter((v) => !v.origem_compra || !v.tipo_compra).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Análise por Classificação"
        subtitle="Totais consolidados a partir dos vínculos do extrato (fonte única da verdade)"
      />

      <MonthNavigator
        selectedMonth={mes}
        onSelectMonth={setMes}
        isAnnual={anual}
        onToggleAnnual={() => setAnual((a) => !a)}
      />

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground rounded-lg border bg-card">
          Nenhum vínculo conciliado no período.
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground px-1">
            {filtrados.length} vínculos no período
            {semClass > 0 && ` · ${semClass} sem classificação completa`}
          </div>
          <MatrizClassificacao vinculos={filtrados} />
        </>
      )}
    </div>
  );
}