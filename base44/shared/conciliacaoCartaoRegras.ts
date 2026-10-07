import { centavos, normConciliacao } from './conciliacaoLeitura.ts';
export const TIPOS_VINCULO_CARTAO = ['ItemCompra', 'DespesaOperacional', 'ObraReforma'];
const stop = new Set(['ltda', 'eireli', 'comercio', 'distribuicao', 'informatica', 'tecnologia', 'brasil', 'servicos']);
export const compraReal = l => Number(l.valor) > 0 && l.fatura_id && !/pagamento.*fatura|pgto.*fatura|pagto.*fatura|credito.*pagamento|nao faz parte/i.test(normConciliacao(`${l.estabelecimento} ${l.observacao}`));
export function evidenciasCartao(l, r, tipo, manual = false) {
  const valor = tipo === 'ItemCompra' ? r.valor_total : r.valor;
  const data = tipo === 'ItemCompra' ? r.data_emissao : r.data;
  const fornecedor = tipo === 'ObraReforma' ? r.responsavel : r.fornecedor;
  const dias = Math.abs(Date.parse(l.data_lancamento) - Date.parse(data)) / 86400000;
  const termos = normConciliacao(fornecedor).split(' ').filter(x => x.length >= 4 && !stop.has(x));
  const nome = normConciliacao(l.estabelecimento).split(' ');
  const nomeConfere = termos.length > 1 ? termos.every(t => nome.includes(t)) : termos.length === 1 && termos[0].length >= 5 && nome.includes(termos[0]);
  const empresaA = normConciliacao(l.empresa_beneficiada), empresaB = normConciliacao(r.empresa);
  const motivos = [];
  const protegido = r.lancamento_bancario_id || r.lancamento_cartao_id || r.status === 'pago' || r.status_pagamento === 'pago' || Number(r.valor_pago) > 0 || r.pagamentos_manuais?.length;
  const conflitante = (empresaA && empresaB && empresaA !== empresaB) || ['tipo_compra', 'origem_compra'].some(k => l[k] && r[k] && l[k] !== r[k]);
  const parcelado = /\b\d+\s*\/\s*\d+\b|\bparc/i.test(`${l.estabelecimento} ${l.observacao}`);
  // A confirmação individual de compras conserva a janela legada; a execução automática permanece estrita.
  const confirmadoIndividualmente = manual && tipo === 'ItemCompra';
  const valorConfere = confirmadoIndividualmente ? Math.abs(centavos(l.valor) - centavos(valor)) <= 50 : centavos(l.valor) === centavos(valor);
  const elegivel = compraReal(l) && Number(valor) > 0 && valorConfere && Number.isFinite(dias) && dias <= (confirmadoIndividualmente ? 60 : 3) && !protegido && !conflitante && (confirmadoIndividualmente || !parcelado);
  if (!nomeConfere) motivos.push('Fornecedor não comprovado');
  if (!empresaA || !empresaB) motivos.push('Empresa não comprovada nos dois registros');
  if (!l.tipo_compra || !r.tipo_compra || !l.origem_compra || !r.origem_compra) motivos.push('Classificação incompleta');
  if (conflitante) motivos.push('Empresa ou classificação conflitante');
  if (parcelado) motivos.push('Parcela exige conferência do documento completo');
  if (protegido) motivos.push('Documento já pago ou vinculado');
  return { elegivel, auto: elegivel && centavos(l.valor) === centavos(valor) && dias <= 3 && !parcelado && motivos.length === 0, motivos, dias, valor: Number(valor), data, fornecedor: fornecedor || '', descricao: r.descricao || r.descricao_produto || '', empresa: r.empresa || '', tipo_compra: r.tipo_compra || '', origem_compra: r.origem_compra || '' };
}