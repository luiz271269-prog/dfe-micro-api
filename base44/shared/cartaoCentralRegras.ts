import { normalizarPedidosHub } from './normalizarPedidosHub.ts';
import { normConciliacao } from './conciliacaoLeitura.ts';

// Regras puras: comparam uma transação do cartão com um pedido lido online da Central de Compras.
export const FORMAS_CENTRAL = { cartao: 'Cartão', banco_pix: 'PIX', banco_boleto: 'Boleto', banco_transferencia: 'Transferência', dinheiro: 'Dinheiro / à vista', nao_definida: 'Não definida' };
const STOP = new Set(['ltda', 'eireli', 'comercio', 'comercial', 'distribuicao', 'distribuidora', 'informatica', 'tecnologia', 'brasil', 'servicos', 'atacado', 'sistemas', 'fornecedor', 'loja', 'store']);
const reais = v => Math.round(Number(v || 0) * 100) / 100;
const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reais(v));
const numeroTexto = t => Number(String(t).replace(/\./g, '').replace(',', '.'));
const NUM = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)';

export function pedidosCentralCartao(pedidos) {
  const lista = []; let ignorados = 0;
  for (const p of pedidos) {
    if (/cancelad/i.test(p.status || '')) continue;
    let itens;
    try { itens = normalizarPedidosHub([p]).itens; } catch { ignorados++; continue; }
    const base = itens[0], total = reais(itens.reduce((s, i) => s + Number(i.valor_total || 0), 0));
    if (!base || !(total > 0)) continue;
    const condicao = String(base.condicao_pagamento || '');
    const declaradas = Number(base.parcelas) > 1 ? Number(base.parcelas) : Number(condicao.match(/(\d{1,2})\s*x\b/i)?.[1] || 1);
    lista.push({ id: p.id, numero: p.numero_pedido || base.pedido_central_id || p.id, fornecedor: base.fornecedor || 'Sem fornecedor', itens: itens.map(i => i.descricao_produto).filter(Boolean).slice(0, 4), total, moeda: base.moeda_original || 'BRL', forma: base.forma_pagamento || 'nao_definida', condicao, parcelas: Math.min(48, Math.max(1, Math.round(declaradas) || 1)), cartao_final: base.cartao_final || '', status: base.status_pagamento || '', empresa: base.empresa || '', data_emissao: base.data_emissao || '', data_criacao_ordem: base.data_criacao_ordem || '', datas: [base.data_emissao, base.data_criacao_ordem].filter(Boolean) });
  }
  return { pedidos: lista, ignorados };
}
export const textoPedidoCentral = p => `${p.numero} ${p.fornecedor} ${p.condicao} ${p.itens.join(' ')}`;

// Valores de parcela escritos na condição de pagamento (ex.: "3x de R$ 624,00", "R$ 3.000,00 (2 x)").
export function valoresCondicao(condicao) {
  const texto = String(condicao || ''), out = [];
  for (const m of texto.matchAll(new RegExp(`(\\d{1,2})\\s*x\\s*(?:de\\s*)?(?:R\\$\\s*)?${NUM}`, 'gi'))) out.push({ parcelas: Number(m[1]), valor: numeroTexto(m[2]) });
  for (const m of texto.matchAll(new RegExp(`R\\$\\s*${NUM}\\s*\\(\\s*(\\d{1,2})\\s*x\\s*\\)`, 'gi'))) out.push({ parcelas: Number(m[2]), valor: numeroTexto(m[1]) / Number(m[2]) });
  if (!out.length) for (const m of texto.matchAll(new RegExp(`R\\$\\s*${NUM}`, 'gi'))) out.push({ parcelas: 1, valor: numeroTexto(m[1]) });
  return out.filter(o => o.parcelas >= 1 && o.parcelas <= 48 && o.valor > 0);
}

export function opcoesValorCentral(valor, pedido) {
  const v = reais(valor), opcoes = [];
  const add = (fonte, parcelas, esperado) => { if (parcelas >= 1 && parcelas <= 48 && esperado > 0) opcoes.push({ fonte, parcelas, esperado: reais(esperado), diferenca: reais(v - esperado) }); };
  valoresCondicao(pedido.condicao).forEach(o => add('condicao', o.parcelas, o.valor));
  add(pedido.parcelas > 1 ? 'parcelas' : 'total', pedido.parcelas, pedido.total / pedido.parcelas);
  if (pedido.parcelas > 1) add('total', 1, pedido.total);
  for (let n = 2; n <= 12; n++) if (n !== pedido.parcelas) add('inferido', n, pedido.total / n);
  const tipo = o => Math.abs(o.diferenca) <= 0.05 ? 'exato' : o.fonte === 'inferido' ? '' : Math.abs(o.diferenca) <= Math.max(0.05, o.esperado * 0.02) ? 'aproximado' : pedido.moeda !== 'BRL' && Math.abs(o.diferenca) <= o.esperado * 0.1 ? 'cambio' : '';
  const ordem = o => ({ exato: 0, aproximado: 10, cambio: 20 })[o.tipo] + ({ condicao: 0, parcelas: 1, total: 1, inferido: 5 })[o.fonte];
  return opcoes.map(o => ({ ...o, tipo: tipo(o) })).filter(o => o.tipo).sort((a, b) => ordem(a) - ordem(b));
}

export function fornecedorConfere(fornecedor, texto) {
  const nome = normConciliacao(fornecedor), alvo = normConciliacao(texto), compacto = alvo.replace(/ /g, ''), nomeCompacto = nome.replace(/ /g, '');
  const termos = nome.split(' ').filter(t => t.length >= 4 && !STOP.has(t));
  return termos.some(t => alvo.split(' ').includes(t) || (t.length >= 5 && compacto.includes(t))) || (nomeCompacto.length >= 6 && compacto.includes(nomeCompacto));
}

// usados: outras transações já vinculadas ao pedido ({ valor, parcela, parcelas, mes }).
export function avaliarPedidoCartao(lancamento, pedido, usados = [], parcelasEscolhidas, mesFatura) {
  const v = reais(lancamento.valor), opcoes = opcoesValorCentral(v, pedido);
  const opcao = parcelasEscolhidas ? opcoes.find(o => o.parcelas === parcelasEscolhidas) : opcoes[0];
  const dias = Math.min(Infinity, ...pedido.datas.map(d => Math.abs(Date.parse(d) - Date.parse(lancamento.data_lancamento)) / 86400000).filter(Number.isFinite));
  const fornecedor = fornecedorConfere(pedido.fornecedor, `${lancamento.estabelecimento || ''} ${lancamento.observacao || ''}`);
  const razoes = [], alertas = [], bloqueios = []; let pontos = 0;
  if (!opcao) bloqueios.push('O valor da transação não confere com o total, as parcelas nem a condição de pagamento do pedido.');
  else if (opcao.tipo === 'exato') {
    pontos += opcao.fonte === 'inferido' ? 25 : 40;
    razoes.push({ condicao: `Valor confere com a condição da Central: ${opcao.parcelas}x de ${brl(opcao.esperado)}`, parcelas: `Valor = parcela de ${opcao.parcelas}x informada na Central (${brl(opcao.esperado)})`, total: 'Valor igual ao total do pedido', inferido: `Valor = 1/${opcao.parcelas} do pedido (${brl(opcao.esperado)}); a Central não informa este parcelamento` }[opcao.fonte]);
  } else { pontos += 15; alertas.push(opcao.tipo === 'cambio' ? `Compra em ${pedido.moeda}: diferença de ${brl(opcao.diferenca)} por câmbio/IOF; confira.` : `Diferença de ${brl(opcao.diferenca)} para ${opcao.parcelas > 1 ? 'a parcela' : 'o total'} (frete, desconto ou arredondamento); confira.`); }
  if (fornecedor) { pontos += 25; razoes.push(`Fornecedor confere: ${pedido.fornecedor}`); } else alertas.push(`O fornecedor do pedido (${pedido.fornecedor}) não aparece na descrição da transação.`);
  if (pedido.forma === 'cartao') { pontos += 20; razoes.push(`A Central informa pagamento no cartão${pedido.condicao ? `: ${pedido.condicao}` : ''}`); }
  else if (pedido.forma === 'nao_definida') { pontos += 5; alertas.push('Forma de pagamento não definida na Central; confirme no pedido.'); }
  else if (pedido.forma === 'dinheiro') alertas.push(`A Central informa "${pedido.condicao || 'dinheiro'}"; confirme se foi pago no cartão.`);
  else bloqueios.push(`A Central informa pagamento por ${FORMAS_CENTRAL[pedido.forma] || pedido.forma}${pedido.condicao ? ` (${pedido.condicao})` : ''}; não é compra no cartão. Corrija a forma no pedido se estiver errada.`);
  if (!Number.isFinite(dias)) alertas.push('Pedido sem data na Central.');
  else { pontos += dias <= 3 ? 15 : dias <= 10 ? 10 : dias <= 45 ? 3 : 0; (dias <= 45 ? razoes : alertas).push(`Pedido a ${Math.round(dias)} dia(s) da data da transação`); }
  if (pedido.cartao_final) razoes.push(`Cartão final ${pedido.cartao_final} informado no pedido`);
  if (pedido.status === 'pago') alertas.push('A Central informa o pedido como pago; é informação de origem e não quita a fatura.');
  const ea = normConciliacao(lancamento.empresa_beneficiada), eb = normConciliacao(pedido.empresa);
  if (ea && eb && ea !== eb) bloqueios.push('Empresas diferentes entre a transação e o pedido.');
  if (lancamento.tipo_compra && lancamento.tipo_compra !== 'estoque') alertas.push(`A transação está classificada como ${lancamento.tipo_compra}; pedidos da Central são compras de estoque.`);
  const grupo = opcao ? usados.filter(u => u.parcelas === opcao.parcelas) : [];
  if (opcao) {
    const soma = usados.reduce((s, u) => s + u.valor, 0) + v, limite = pedido.total * (pedido.moeda !== 'BRL' ? 1.1 : 1.02) + 0.05 * opcao.parcelas;
    if (grupo.length >= opcao.parcelas) bloqueios.push(`As ${opcao.parcelas} parcela(s) deste pedido já estão vinculadas a outras transações. Confira se esta cobrança está duplicada.`);
    else if (soma > limite) bloqueios.push('A soma das transações vinculadas excederia o valor do pedido.');
  }
  const ocupadas = grupo.map(u => u.parcela).filter(Boolean), total = opcao?.parcelas || 1;
  let sugerida = Math.min(total, grupo.filter(u => u.mes && mesFatura && u.mes < mesFatura).length + 1);
  if (ocupadas.includes(sugerida)) sugerida = Array.from({ length: total }, (_, i) => i + 1).find(n => !ocupadas.includes(n)) || sugerida;
  return { id: pedido.id, numero: pedido.numero, fornecedor: pedido.fornecedor, itens: pedido.itens, total: pedido.total, moeda: pedido.moeda, forma: pedido.forma, forma_rotulo: FORMAS_CENTRAL[pedido.forma] || pedido.forma, condicao: pedido.condicao, cartao_final: pedido.cartao_final, status: pedido.status, data: pedido.data_emissao || pedido.data_criacao_ordem || '',
    opcao: opcao ? { parcelas: opcao.parcelas, esperado: opcao.esperado, fonte: opcao.fonte, tipo: opcao.tipo } : null, parcela_sugerida: sugerida, parcelas_ocupadas: ocupadas, vinculadas: grupo.length,
    pontos: Math.min(100, pontos), razoes, alertas, bloqueios, dias: Number.isFinite(dias) ? Math.round(dias) : null,
    sugerivel: !!opcao && dias <= 45 && ((opcao.tipo === 'exato' && opcao.fonte !== 'inferido') || fornecedor) };
}