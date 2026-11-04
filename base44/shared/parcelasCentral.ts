export const dataCentral = valor => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.slice(0, 10)) ? valor.slice(0, 10) : '';
const dividir = (centavos, numero, indice) => Math.floor(centavos / numero) + (indice < centavos % numero ? 1 : 0);

// Projeção de leitura: não cria títulos nem certifica pagamentos no financeiro.
export function parcelasCentral(pedido, total, pago, original) {
  const condicao = pedido.condicao_pagamento || pedido.forma_pagamento || '';
  const numero = Number(pedido.parcelas || condicao.match(/\b(\d+)x\b/i)?.[1] || 1);
  if (!Number.isInteger(numero) || numero < 1 || numero > 120) throw new Error(`Parcelamento inválido no pedido ${pedido.numero_pedido}.`);
  const inicio = dataCentral(pedido.data_vencimento) || dataCentral(pedido.prazo_pagamento);
  const prazos = /boleto/i.test(condicao) ? (condicao.match(/\b\d+(?:\/\d+)+\b/)?.[0] || '').split('/').map(Number) : [];
  let saldoPago = Math.max(0, Math.round(pago * 100));
  return Array.from({ length: numero }, (_, indice) => {
    const centavos = dividir(Math.round(total * 100), numero, indice);
    const alocado = Math.min(centavos, saldoPago);
    saldoPago -= alocado;
    let vencimento = inicio;
    if (inicio && indice > 0) {
      const [ano, mes, dia] = inicio.split('-').map(Number);
      const data = new Date(Date.UTC(ano, mes - 1, dia));
      if (prazos.length === numero) data.setUTCDate(dia + prazos[indice] - prazos[0]);
      else {
        data.setUTCDate(1); data.setUTCMonth(mes - 1 + indice);
        const ultimoDia = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0)).getUTCDate();
        data.setUTCDate(Math.min(dia, ultimoDia));
      }
      vencimento = data.toISOString().slice(0, 10);
    }
    return { numero: indice + 1, quantidade: numero, data_vencimento: vencimento,
      vencimento_previsto: indice > 0 && Boolean(inicio), valor_previsto: numero > 1,
      valor_compra: centavos / 100, valor: (centavos - alocado) / 100,
      valor_original: dividir(Math.round(original * 100), numero, indice) / 100 };
  }).filter(parcela => parcela.valor > 0);
}