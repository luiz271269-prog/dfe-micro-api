import { Wallet } from 'lucide-react';
import { DemoCard, LinhaDemo } from './DemoCard';
import { fmtMes } from '@/components/shared/MonthNavigator';

export default function ResultadoCaixaCard({ caixa: cx, mes, onDrill }) {
  const p = cx.pagamentos, r = cx.retiradas;
  const outros = [r.proLabore, r.pessoal, cx.investimentos, cx.financeiros, cx.aplicacoes, cx.transferenciasForaPerimetro, cx.naoClassificado];
  const totalOutros = outros.reduce((s, l) => s + l.valor, 0);
  return (
    <DemoCard icon={Wallet} titulo="Resultado de Caixa" subtitulo="(Movimentação)" badge={fmtMes(mes)} tom="blue">
      <LinhaDemo rotulo="Entradas de Caixa" valor={cx.recebimentos.valor} nivel="grupo" tom="green" />
      <LinhaDemo rotulo="Recebimentos operacionais" valor={cx.recebimentos.valor} linha={cx.recebimentos} onDrill={onDrill} />

      <LinhaDemo rotulo="Saídas de Caixa" valor={cx.totalPagamentos} nivel="grupo" tom="red" />
      <LinhaDemo rotulo="Compras (fornecedores)" valor={p.compras.valor} linha={p.compras} onDrill={onDrill} />
      <LinhaDemo rotulo="Faturas de cartão" valor={p.cartao.valor} linha={p.cartao} onDrill={onDrill} />
      <LinhaDemo rotulo="Impostos pagos" valor={p.tributos.valor} linha={p.tributos} onDrill={onDrill} />
      <LinhaDemo rotulo="Folha de pagamento" valor={p.folha.valor} linha={p.folha} onDrill={onDrill} />
      <LinhaDemo rotulo="Outras despesas" valor={p.despesas.valor} linha={p.despesas} onDrill={onDrill} />
      <LinhaDemo rotulo="Caixa gerado pela Operação" valor={cx.caixaOperacao} nivel="subtotal" tom="blue" />

      <LinhaDemo rotulo="Retiradas, Investimentos e Financeiro" valor={totalOutros} nivel="grupo" tom="red" />
      <LinhaDemo rotulo="Pró-labore" valor={r.proLabore.valor} linha={r.proLabore} onDrill={onDrill} />
      <LinhaDemo rotulo="Retiradas pessoais" valor={r.pessoal.valor} linha={r.pessoal} onDrill={onDrill} />
      <LinhaDemo rotulo="Obras e investimentos" valor={cx.investimentos.valor} linha={cx.investimentos} onDrill={onDrill} />
      <LinhaDemo rotulo="Financeiros (tarifas, juros, empréstimos)" valor={cx.financeiros.valor} linha={cx.financeiros} onDrill={onDrill} />
      <LinhaDemo rotulo="Aplicações / resgates" valor={cx.aplicacoes.valor} linha={cx.aplicacoes} onDrill={onDrill} />
      {cx.transferenciasForaPerimetro.registros > 0 && <LinhaDemo rotulo="Transferências fora do perímetro" valor={cx.transferenciasForaPerimetro.valor} linha={cx.transferenciasForaPerimetro} onDrill={onDrill} />}
      {cx.naoClassificado.registros > 0 && <LinhaDemo rotulo="⚠ Não classificado (requer Loop-R)" valor={cx.naoClassificado.valor} linha={cx.naoClassificado} onDrill={onDrill} />}

      <LinhaDemo rotulo="Resultado de Caixa" valor={cx.resultado} nivel="total" tom="blue" />
    </DemoCard>
  );
}