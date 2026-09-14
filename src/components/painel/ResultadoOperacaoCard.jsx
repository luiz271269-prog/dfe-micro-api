import { Scale } from 'lucide-react';
import { DemoCard, LinhaDemo } from './DemoCard';
import { fmtMes } from '@/components/shared/MonthNavigator';

export default function ResultadoOperacaoCard({ operacao: op, mes, onDrill }) {
  const f = op.faturamento.fontes;
  const desp = op.despesas.componentes;
  const totalDespesas = op.cmvEstimado.valor + op.tributos.valor + op.folha.valor + op.despesas.valor;
  return (
    <DemoCard icon={Scale} titulo="Resultado da Operação" subtitulo="(Competência)" badge={fmtMes(mes)} tom="green">
      <LinhaDemo rotulo="Receitas Operacionais" valor={op.faturamento.valor} nivel="grupo" tom="green" />
      <LinhaDemo rotulo="Vendas de produtos" valor={f.produtos.valor} linha={f.produtos} onDrill={onDrill} />
      <LinhaDemo rotulo="Serviços / Assistência" valor={f.servicos.valor} linha={f.servicos} onDrill={onDrill} />
      <LinhaDemo rotulo="Locações" valor={f.locacoes.valor} linha={f.locacoes} onDrill={onDrill} />

      <LinhaDemo rotulo="Despesas Diretas da Operação" valor={-totalDespesas} nivel="grupo" tom="red" />
      <LinhaDemo rotulo={op.cmvEstimado.fonteStatus === 'indisponivel' ? 'CMV indisponível — Central desconectada' : 'Custo de mercadorias (CMV estimado)'} valor={-op.cmvEstimado.valor} linha={op.cmvEstimado} onDrill={onDrill} />
      <LinhaDemo rotulo="Impostos da operação" valor={-op.tributos.valor} linha={op.tributos} onDrill={onDrill} />
      <LinhaDemo rotulo="Folha de pagamento (operacional)" valor={-op.folha.valor} linha={op.folha} onDrill={onDrill} />
      <LinhaDemo rotulo="Outras despesas operacionais" valor={-desp.despesasOp.valor} linha={desp.despesasOp} onDrill={onDrill} />
      <LinhaDemo rotulo="Manutenção (obras)" valor={-desp.obrasManutencao.valor} linha={desp.obrasManutencao} onDrill={onDrill} />

      <LinhaDemo rotulo="Resultado da Operação" valor={op.resultado} nivel="total" tom="green"
        sub={op.margemOperacional != null ? `${op.margemOperacional}% do faturamento` : undefined} />
    </DemoCard>
  );
}