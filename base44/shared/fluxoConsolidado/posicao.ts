// Posição final: saldo inicial verificável + resultado de caixa = saldo final bancário (decisões 5, 6).
import { arred, perimetroDaConta } from './evidencia.ts';

const saldoAntes = (l) => arred(l.saldo_apos - (l.valor || 0));

// Último saldo do dia pela cadeia do extrato (saldo_apos - valor == saldo anterior), não pela ordem de importação:
// lançamentos importados no mesmo segundo perdem a ordem original, e o fim da cadeia é o saldo que nenhum outro precede.
// Se o dia tem mais de um fim (cadeia quebrada por lançamento faltante), vale o que encadeia com os dias seguintes.
function ultimoSaldo(ord, depois = []) {
  if (!ord.length) return null;
  const doDia = ord.filter((l) => l.data === ord[ord.length - 1].data);
  const anteriores = new Set(doDia.map(saldoAntes));
  const fins = doDia.filter((l) => !anteriores.has(arred(l.saldo_apos)));
  const continuados = new Set(depois.map(saldoAntes));
  const fim = fins.find((l) => continuados.has(arred(l.saldo_apos))) || fins[0] || doDia[doDia.length - 1];
  return fim.saldo_apos;
}

// Lacunas do extrato importado: lançamento cujo saldo anterior não é saldo_apos de nenhum outro → falta importar o que vem antes.
// Pareia cada quebra com a ponta (saldo que ninguém continua) imediatamente anterior; a diferença é o valor que falta.
function lacunasExtrato(ord, inicio, fim) {
  const saldos = new Set(ord.map((l) => arred(l.saldo_apos)));
  const antes = new Set(ord.map(saldoAntes));
  const pontas = ord.filter((l) => !antes.has(arred(l.saldo_apos)));
  return ord
    .filter((l) => l.data >= inicio && l.data <= fim && !saldos.has(saldoAntes(l)) && l !== ord[0])
    .map((q) => {
      const p = [...pontas].reverse().find((p) => p.data <= q.data && p !== q);
      return p ? { de: p.data, ate: q.data, saldoDe: p.saldo_apos, saldoAte: saldoAntes(q), valor: arred(saldoAntes(q) - p.saldo_apos) } : null;
    })
    .filter((x) => x && Math.abs(x.valor) >= 0.01);
}

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
    const saldoInicial = ultimoSaldo(antes, ord.filter((l) => l.data >= inicio));
    const saldoFinal = ultimoSaldo(ate, ord.filter((l) => l.data > fim));
    const lacunas = lacunasExtrato(ord, inicio, fim);
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
      lacunasExtrato: lacunas, // trechos do extrato que faltam importar (cadeia de saldos quebrada)
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