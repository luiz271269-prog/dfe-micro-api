import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import MonthNavigator from '@/components/shared/MonthNavigator';
import MatrizClassificacao from '@/components/classificacao/MatrizClassificacao';
import DrilldownVinculos from '@/components/classificacao/DrilldownVinculos';
import CoberturaPeriodo from '@/components/classificacao/CoberturaPeriodo';
import RodarPipelineButton from '@/components/classificacao/RodarPipelineButton';
import ExportarCSVButton from '@/components/classificacao/ExportarCSVButton';
import ClassificarNaoCobertos from '@/components/classificacao/ClassificarNaoCobertos';
import PlanilhaCoberturaModulos from '@/components/classificacao/PlanilhaCoberturaModulos';

export default function AnaliseClassificacao() {
  const [vinculos, setVinculos] = useState([]);
  const [lancs, setLancs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [anual, setAnual] = useState(false);
  const [drill, setDrill] = useState(null);
  const [classificando, setClassificando] = useState(false);

  const carregar = async () => {
      setLoading(true);
      const [v, l] = await Promise.all([
        base44.entities.VinculoExtrato.list('-created_date', 10000),
        base44.entities.LancamentoBancario.list('-data', 10000),
      ]);
      setVinculos(v || []);
      setLancs(l || []);
      setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const lancPorId = useMemo(() => {
    const m = {};
    for (const l of lancs) m[l.id] = l;
    return m;
  }, [lancs]);
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

  const lancsPeriodo = useMemo(() => {
    const ano = mes.slice(0, 4);
    return lancs.filter((l) => (anual ? (l.data || '').startsWith(ano) : (l.data || '').startsWith(mes)));
  }, [lancs, mes, anual]);

  const idsComVinculo = useMemo(
    () => new Set(vinculos.map((v) => v.lancamento_bancario_id)),
    [vinculos]
  );

  // Lançamentos sem vínculo mas classificados manualmente entram na matriz como linha direta
  const diretos = useMemo(
    () =>
      lancsPeriodo
        // só saídas: entradas (recebimentos) não são "compras" e distorceriam a matriz
        .filter((l) => !idsComVinculo.has(l.id) && (l.valor || 0) < 0 && l.origem_compra && l.tipo_compra)
        .map((l) => ({
          id: `direto-${l.id}`,
          lancamento_bancario_id: l.id,
          entidade_tipo: 'Extrato (direto)',
          origem_compra: l.origem_compra,
          tipo_compra: l.tipo_compra,
          valor_alocado: Math.abs(l.valor || 0),
        })),
    [lancsPeriodo, idsComVinculo]
  );

  const linhas = useMemo(() => [...filtrados, ...diretos], [filtrados, diretos]);

  const idsCobertos = useMemo(() => {
    const s = new Set(idsComVinculo);
    for (const d of diretos) s.add(d.lancamento_bancario_id);
    return s;
  }, [idsComVinculo, diretos]);

  const naoCobertos = useMemo(
    () => lancsPeriodo.filter((l) => (l.valor || 0) < 0 && !idsCobertos.has(l.id)),
    [lancsPeriodo, idsCobertos]
  );

  const atualizarLanc = (id, field, valor) =>
    setLancs((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: valor } : l)));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Análise por Classificação"
        subtitle="Totais consolidados a partir dos vínculos do extrato (fonte única da verdade)"
      >
        <RodarPipelineButton onConcluido={carregar} />
        <ExportarCSVButton
          vinculos={linhas}
          lancPorId={lancPorId}
          nomeArquivo={`classificacao-${anual ? mes.slice(0, 4) : mes}`}
        />
      </PageHeader>

      <PlanilhaCoberturaModulos />

      <MonthNavigator
        selectedMonth={mes}
        onSelectMonth={setMes}
        isAnnual={anual}
        onToggleAnnual={() => setAnual((a) => !a)}
      />

      {!loading && (
        <CoberturaPeriodo
          lancsPeriodo={lancsPeriodo.filter((l) => (l.valor || 0) < 0)}
          idsComVinculo={idsCobertos}
          onVerNaoCobertos={() => setClassificando(true)}
        />
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground rounded-lg border bg-card">
          Nenhum vínculo conciliado no período.
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground px-1">
            {filtrados.length} vínculos{diretos.length > 0 ? ` + ${diretos.length} classificados direto no extrato` : ''} no período
            {semClass > 0 && ` · ${semClass} sem classificação completa`}
          </div>
          <MatrizClassificacao
            vinculos={linhas}
            onSelecionar={(titulo, itens) => setDrill({
              titulo,
              itens: itens.map((v) => ({
                ...v,
                data: lancPorId[v.lancamento_bancario_id]?.data,
                descricao: lancPorId[v.lancamento_bancario_id]?.descricao,
              })),
            })}
          />
        </>
      )}

      <DrilldownVinculos
        open={!!drill}
        onOpenChange={(o) => !o && setDrill(null)}
        titulo={drill?.titulo}
        itens={drill?.itens}
      />

      <ClassificarNaoCobertos
        open={classificando}
        onOpenChange={setClassificando}
        lancs={naoCobertos}
        onClassificado={atualizarLanc}
      />
    </div>
  );
}