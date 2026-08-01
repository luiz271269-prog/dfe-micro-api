import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import ResumoExecutivo from '@/components/relatorio/ResumoExecutivo';
import EvolucaoMensal from '@/components/relatorio/EvolucaoMensal';
import TabelaDesempenho from '@/components/relatorio/TabelaDesempenho';
import ComparativoReceitaCustos from '@/components/relatorio/ComparativoReceitaCustos';
import TabelaMensalPorTipo from '@/components/relatorio/TabelaMensalPorTipo';
import {
  construirLinhas,
  ultimosMeses,
  desempenhoPorCategoria,
  serieMensal,
  comparativoMensal,
} from '@/lib/consolidadoClassificacao';

const PERIODOS = [3, 6, 12];

export default function RelatorioGerencial() {
  const [vinculos, setVinculos] = useState([]);
  const [lancs, setLancs] = useState([]);
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(6);

  useEffect(() => {
    (async () => {
      const [v, l, n] = await Promise.all([
        base44.entities.VinculoExtrato.list('-created_date', 3000),
        base44.entities.LancamentoBancario.list('-data', 3000),
        base44.entities.NotaFiscal.list('-data_emissao', 3000),
      ]);
      setVinculos(v);
      setLancs(l);
      setNotas(n);
      setLoading(false);
    })();
  }, []);

  const linhas = useMemo(() => construirLinhas(vinculos, lancs), [vinculos, lancs]);
  const meses = useMemo(() => ultimosMeses(linhas, periodo), [linhas, periodo]);
  const doPeriodo = useMemo(() => linhas.filter((r) => meses.includes(r.mes)), [linhas, meses]);
  const serie = useMemo(() => serieMensal(doPeriodo, meses), [doPeriodo, meses]);
  const porTipo = useMemo(() => desempenhoPorCategoria(linhas, meses, 'tipo'), [linhas, meses]);
  const porOrigem = useMemo(() => desempenhoPorCategoria(linhas, meses, 'origem'), [linhas, meses]);
  const comparativo = useMemo(() => comparativoMensal(linhas, notas, meses), [linhas, notas, meses]);

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Relatório Gerencial"
        subtitle="Desempenho dos gastos classificados por tipo de compra e por quem comprou"
      >
        <div className="flex items-center gap-1">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                periodo === p ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
              }`}
            >
              {p} meses
            </button>
          ))}
        </div>
      </PageHeader>

      {loading ? (
        <p className="text-sm text-muted-foreground px-2">Carregando dados...</p>
      ) : meses.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">Nenhum gasto classificado encontrado.</p>
      ) : (
        <>
          <ResumoExecutivo serie={serie} porTipo={porTipo} meses={meses} />
          <ComparativoReceitaCustos dados={comparativo.dados} tipos={comparativo.tipos} />
          <TabelaMensalPorTipo dados={comparativo.dados} tipos={comparativo.tipos} />
          <EvolucaoMensal serie={serie} />
          <TabelaDesempenho titulo="Desempenho por tipo de compra" eixo="tipo" dados={porTipo} />
          <TabelaDesempenho titulo="Desempenho por quem comprou" eixo="origem" dados={porOrigem} />
        </>
      )}
    </div>
  );
}