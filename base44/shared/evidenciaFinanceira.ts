import { PAGAVEIS } from './direcaoFinanceira.ts';
import { MATRIZ_IMPORTACAO } from './importacaoContrato.ts';
export const TIPOS = MATRIZ_IMPORTACAO.filter(m=>m.evidencia).map(m=>m.tipo);
export const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export function normalizarEvidencia(tipo, r, arquivo) {
  const valor = Math.abs(Number(tipo === 'boletos_liquidados' ? r.valor_pago : tipo === 'relatorio_nfs' ? r.valor_total : r.valor));
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Evidência sem valor positivo.');
  const data = String(tipo === 'boletos_liquidados' ? r.data_pagamento || '' : r.data_emissao || r.data || '').slice(0,10);
  const vencimento = String(r.data_vencimento || (tipo === 'dda_boletos' ? r.data : '') || '').slice(0,10);
  if (tipo === 'boletos_liquidados' && !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Boleto sem data de pagamento comprovada.');
  const referencia = String(r.nosso_numero || r.numero || r.detalhe || '').trim().slice(0,200);
  const contraparte = String(r.cliente || r.fornecedor || r.descricao || '').slice(0,300);
  const referenciaNota = String(r.seu_numero || '').slice(0,100);
  if (!referencia && !contraparte) throw new Error('Evidência sem identificador ou contraparte.');
  return { chave: [tipo, norm(referencia), norm(referenciaNota), norm(contraparte), vencimento, data, Math.round(valor*100)].join('|'), tipo, direcao: tipo === 'dda_boletos' ? 'saida' : 'entrada', referencia, referencia_nota: referenciaNota, tipo_nota: r.tipo || 'NF', contraparte, data, vencimento, valor, conta: String(r.conta_bancaria || ''), arquivo_nome: arquivo.nome || '', arquivo_hash: arquivo.hash || '' };
}
export async function candidatosEvidencia(db, ev, tipoDestino) {
  const tipo = ev.tipo === 'boletos_liquidados' ? 'TituloCobranca' : ev.tipo === 'relatorio_nfs' ? 'NotaFiscal' : tipoDestino || 'ItemCompra';
  if (ev.tipo === 'dda_boletos' && !PAGAVEIS.includes(tipo)) throw new Error('DDA só pode identificar obrigações a pagar.');
  let query;
  if (tipo === 'TituloCobranca') {
    const alternativas = [];
    if (ev.referencia && !ev.referencia.startsWith('BOL-')) alternativas.push({ nosso_numero: ev.referencia });
    if (ev.referencia_nota && ev.contraparte) alternativas.push({ seu_numero: ev.referencia_nota, cliente: ev.contraparte });
    if (ev.contraparte && ev.vencimento) alternativas.push({ cliente: ev.contraparte, data_vencimento: ev.vencimento });
    if (!alternativas.length) return { tipo, itens: [] };
    query = { $or: alternativas };
  } else if (tipo === 'NotaFiscal') query = { numero: ev.referencia, tipo: ev.tipo_nota };
  else {
    const campos = { ItemCompra: 'valor_total', DespesaOperacional: 'valor', Tributo: 'valor_original', FolhaPagamento: 'salario_liquido', FaturaCartao: 'valor_total', ObraReforma: 'valor' };
    query = { [campos[tipo]]: { $gte: ev.valor - 0.01, $lte: ev.valor + 0.01 } };
    if (ev.vencimento && tipo !== 'ObraReforma' && tipo !== 'FolhaPagamento') query.data_vencimento = ev.vencimento;
  }
  const pagina = await db[tipo].filter(query, { limit: 50 });
  return { tipo, itens: pagina.items.map(r => ({ id:r.id, nome:r.cliente || r.fornecedor || r.funcionario_nome || r.descricao || r.responsavel || r.tipo || r.numero || r.mes_referencia, referencia:r.nosso_numero || r.numero || r.numero_nota || '', valor: Number(r.valor_titulo ?? r.valor_total ?? r.valor_original ?? r.salario_liquido ?? r.valor ?? 0), data:r.data_vencimento || r.data || r.data_emissao })) };
}