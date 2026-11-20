import { Scale } from 'lucide-react';
import { DemoCard, LinhaDemo } from './DemoCard';
import { fmtMes } from '@/components/shared/MonthNavigator';

export default function ResultadoOperacaoCard({ operacao: op, mes, onDrill }) {
  const f = op.faturamento.fontes;
  const desp = op.despesas.componentes;
  const deducoesCmv = op.tributos.valor + op.cmvEstimado.valor;
  const despesasOperacionais = op.folha.valor + op.despesas.valor;
  const resultadoBruto = op.faturamento.valor - deducoesCmv;
  const cmvLabel = op.cmvEstimado.fonteStatus === 'indisponivel'
    ? 'CMV indisponível — Central desconectada'
    : 'Custo das mercadorias vendidas (CMV)';
  return (
    <DemoCard icon={Scale} titulo="Resultado da Operação" subtitulo="Competência · o que foi faturado" badge={fmtMes(mes)} tom="green">
      <LinhaDemo rotulo="Receita bruta de vendas e serviços" valor={op.faturamento.valor} nivel="grupo" tom="green" />
      <LinhaDemo rotulo="Vendas de produtos" valor={f.produtos.valor} linha={f.produtos} onDrill={onDrill} />
      <LinhaDemo rotulo="Serviços / Assistência" valor={f.servicos.valor} linha={f.servicos} onDrill={onDrill} />
      <LinhaDemo rotulo="Locações" valor={f.locacoes.valor} linha={f.locacoes} onDrill={onDrill} />

      <LinhaDemo rotulo="(−) Deduções e custos da operação" valor={-deducoesCmv} nivel="grupo" tom="red" />
      <LinhaDemo rotulo="Deduções e tributos sobre vendas" valor={-op.tributos.valor} linha={op.tributos} onDrill={onDrill} />
      <LinhaDemo rotulo={cmvLabel} valor={-op.cmvEstimado.valor} linha={op.cmvEstimado} onDrill={onDrill} />

      <LinhaDemo rotulo="= Resultado bruto" valor={resultadoBruto} nivel="subtotal" tom="green" />

      <LinhaDemo rotulo="(−) Despesas operacionais" valor={-despesasOperacionais} nivel="grupo" tom="red" />
      <LinhaDemo rotulo="Pessoal: salários, encargos e benefícios" valor={-op.folha.valor} linha={op.folha} onDrill={onDrill} />
      <LinhaDemo rotulo="Despesas administrativas e operacionais" valor={-desp.despesasOp.valor} linha={desp.despesasOp} onDrill={onDrill} />
      <LinhaDemo rotulo="Manutenção de obras e instalações" valor={-desp.obrasManutencao.valor} linha={desp.obrasManutencao} onDrill={onDrill} />

      <LinhaDemo rotulo="= Resultado operacional" valor={op.resultado} nivel="total" tom="green"
        sub={op.margemOperacional != null ? `${op.margemOperacional}% do faturamento` : undefined} />
    </DemoCard>
  );
}