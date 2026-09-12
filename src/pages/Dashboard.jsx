import { useEffect, useState } from 'react';
import { getCurrentMonth } from '@/lib/currentMonth';
import { useFluxoConsolidado } from '@/hooks/useFluxoConsolidado';
import { carregarDrill } from '@/lib/painel/drillColunas';
import PainelHeader, { fmtMesLong } from '@/components/painel/PainelHeader';
import KpiGrid from '@/components/painel/KpiGrid';
import ResultadoOperacaoCard from '@/components/painel/ResultadoOperacaoCard';
import ResultadoCaixaCard from '@/components/painel/ResultadoCaixaCard';
import BridgeCard from '@/components/painel/BridgeCard';
import FaturamentoFonteCard from '@/components/painel/FaturamentoFonteCard';
import EvolucaoCard from '@/components/painel/EvolucaoCard';
import ContasAbertoCard from '@/components/painel/ContasAbertoCard';
import PosicaoFinalCard from '@/components/painel/PosicaoFinalCard';
import RodapePainel from '@/components/painel/RodapePainel';
import DrilldownDialog from '@/components/dashboard/DrilldownDialog';

export default function Dashboard() {
  const [mes, setMes] = useState(getCurrentMonth());
  const [perimetro, setPerimetro] = useState('grupo');
  const [drill, setDrill] = useState(null);
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useFluxoConsolidado(mes, perimetro);

  useEffect(() => {
    const h = () => refetch();
    window.addEventListener('neuralfinRefresh', h);
    return () => window.removeEventListener('neuralfinRefresh', h);
  }, [refetch]);

  const onDrill = async (linha) => setDrill(await carregarDrill(linha, fmtMesLong(mes)));

  return (
    <div className="lg:px-6 lg:py-6 max-w-[1600px] mx-auto space-y-4">
      <PainelHeader mes={mes} onMes={setMes} perimetro={perimetro} onPerimetro={setPerimetro} onRefresh={refetch} refreshing={isFetching} />

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-32 gap-3 text-sm text-muted-foreground">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          Calculando o fluxo consolidado de {fmtMesLong(mes)}…
        </div>
      )}
      {isError && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-sm">Não foi possível calcular o painel: {error?.message}</div>}

      {data && (
        <>
          <KpiGrid dados={data} onDrill={onDrill} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ResultadoOperacaoCard operacao={data.operacao} mes={mes} onDrill={onDrill} />
            <ResultadoCaixaCard caixa={data.caixa} mes={mes} onDrill={onDrill} />
          </div>
          <BridgeCard bridge={data.bridge} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FaturamentoFonteCard operacao={data.operacao} mes={mes} onDrill={onDrill} />
            <EvolucaoCard historico={data.historico} />
            <ContasAbertoCard aberto={data.aberto} />
          </div>
          <PosicaoFinalCard posicao={data.posicao} loopR={data.loopR} mes={mes} />
          <RodapePainel dados={data} atualizadoEm={dataUpdatedAt} />
        </>
      )}

      <DrilldownDialog drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}