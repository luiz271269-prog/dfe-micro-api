// Posição final: saldo inicial verificável + resultado de caixa = saldo final bancário (decisões 5, 6).
import { arred, perimetroDaConta } from './evidencia.ts';

export function calcularPosicao(dados, mes, perimetro, hoje, resultadoCaixa) {
  const inicio = `${mes}-01`;
  const fim = mes === hoje.slice(0, 7) ? hoje : `${mes}-31`;
  const comSaldo = dados.LancamentoBancario.filter((l) => l.saldo_apos != null && l.data && l.data <= hoje);
  // toda conta com movimento no mês entra; conta sem saldo_apos fica não verificável (não é omitida)
  const contas = [...new Set(dados.LancamentoBancario.filter((l) => l.data >= inicio && l.data <= fim).map((l) => l.conta_bancaria))]
    .filter((c) => perimetro === 'grupo' || perimetroDaConta(c) === perimetro);

  const porConta = contas.map((conta) => {
    const ord = comSaldo.filter((l) => l.conta_bancaria === conta).sort((a, b) => a.data.localeCompare(b.data) || a.created_date.localeCompare(b.created_date));
    const antes = ord.filter((l) => l.data < inicio);
    const ate = ord.filter((l) => l.data <= fim);
    const saldoInicial = antes.length ? antes[antes.length - 1].saldo_apos : null;
    const saldoFinal = ate.length ? ate[ate.length - 1].saldo_apos : null;
    const doMes = dados.LancamentoBancario.filter((l) => l.conta_bancaria === conta && l.data >= inicio && l.data <= fim);
    const movimento = arred(doMes.reduce((s, l) => s + (l.valor || 0), 0));
    // lançamentos sem saldo_apos não vieram do extrato importado (baixa manual) — candidatos a duplicidade
    const semSaldo = doMes.filter((l) => l.saldo_apos == null);
    const semSaldoExtrato = { registros: semSaldo.length, valor: arred(semSaldo.reduce((s, l) => s + (l.valor || 0), 0)), ids: semSaldo.map((l) => l.id) };
    const variacao = saldoInicial != null && saldoFinal != null ? arred(saldoFinal - saldoInicial) : null;
    return {
      conta, empresa: perimetroDaConta(conta), saldoInicial, saldoFinal, movimento, variacao,
      diferencaExtrato: variacao != null ? arred(variacao - movimento) : null, // extrato incompleto ou duplicado se ≠ 0
      semSaldoExtrato,
      verificavel: saldoInicial != null && saldoFinal != null,
    };
  });

  const somaOuNull = (campo) => porConta.every((c) => c[campo] != null) ? arred(porConta.reduce((s, c) => s + c[campo], 0)) : null;
  const saldoInicial = somaOuNull('saldoInicial');
  const saldoFinal = somaOuNull('saldoFinal');
  const saldoCalculado = saldoInicial != null ? arred(saldoInicial + resultadoCaixa) : null;
  return {
    porConta, saldoInicial, saldoFinal, resultadoCaixa, saldoCalculado,
    diferencaBancaria: saldoFinal != null && saldoCalculado != null ? arred(saldoFinal - saldoCalculado) : null,
    verificavel: porConta.length > 0 && porConta.every((c) => c.verificavel),
  };
}