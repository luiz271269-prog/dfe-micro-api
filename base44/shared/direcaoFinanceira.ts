export const RECEBIVEIS = ['TituloCobranca', 'NotaFiscal'];
export const PAGAVEIS = ['ItemCompra', 'DespesaOperacional', 'Tributo', 'FolhaPagamento', 'FaturaCartao', 'ObraReforma'];
const NEUTRAS = ['transferencia', 'transferencia_interna', 'interno', 'aporte', 'emprestimo', 'aplicacao', 'resgate'];
export function direcaoBanco(lanc) {
  if (NEUTRAS.includes(lanc?.categoria) || lanc?.status_conciliacao === 'ignorar') return 'conferencia';
  const valor = Number(lanc?.valor);
  return !Number.isFinite(valor) || !valor ? 'conferencia' : valor > 0 ? 'entrada' : 'saida';
}
export function erroDirecao(lanc, tipo, tipoVinculo) {
  const direcao = direcaoBanco(lanc);
  if (tipo === 'TransferenciaInterna') return null;
  if (tipo === 'MovimentoFinanceiro') return null;
  const destino = RECEBIVEIS.includes(tipo) ? 'entrada' : PAGAVEIS.includes(tipo) ? 'saida' : null;
  if (!destino) return 'Tipo de destino financeiro não permitido.';
  if (direcao === 'conferencia') return 'Movimento de conferência não pode quitar recebíveis ou obrigações operacionais.';
  if (destino !== direcao) return `Conciliação bloqueada: ${direcao === 'entrada' ? 'créditos só conciliam recebíveis' : 'débitos só conciliam contas a pagar'}.`;
  if (tipoVinculo && tipoVinculo !== 'adiantamento' && (destino === 'entrada' ? !tipoVinculo.startsWith('recebimento_') : tipoVinculo.startsWith('recebimento_'))) return 'Natureza do vínculo incompatível com a direção.';
  return null;
}
export async function recalcularRecebivel(db, tipo, id) {
  const reg = await db[tipo].get(id);
  const vinculos = await db.VinculoExtrato.filter({ entidade_tipo: tipo, entidade_id: id });
  const bancos = vinculos.length ? await db.LancamentoBancario.filter({ id: { $in: [...new Set(vinculos.map(v => v.lancamento_bancario_id))] } }) : [];
  const validos = vinculos.filter(v => bancos.some(b => b.id === v.lancamento_bancario_id && direcaoBanco(b) === 'entrada'));
  const soma = Math.round(validos.reduce((s,v) => s + Number(v.valor_alocado || 0), 0) * 100) / 100;
  const data = bancos.map(b => b.data).filter(Boolean).sort().at(-1) || null;
  if (tipo === 'TituloCobranca') {
    const devido = Number(reg.valor_titulo || 0);
    await db.TituloCobranca.update(id, { valor_pago: soma, status: soma > 0 && devido - soma <= 0.01 ? 'pago' : reg.data_vencimento < new Date().toISOString().slice(0,10) ? 'vencido' : 'em_aberto', data_pagamento: soma > 0 ? data : null, lancamento_bancario_id: bancos.length === 1 ? bancos[0].id : null });
    if (reg.nota_fiscal_id) {
      const totais = await db.TituloCobranca.aggregate({ query: { nota_fiscal_id: reg.nota_fiscal_id }, sum: 'valor_pago' });
      const nota = await db.NotaFiscal.get(reg.nota_fiscal_id);
      const recebido = Number(totais.rows[0]?.sum_valor_pago || 0);
      const aberto = Math.max(0, Number(nota.valor_total || 0) - recebido);
      await db.NotaFiscal.update(nota.id, { valor_recebido: recebido, valor_aberto: aberto, status: aberto <= 0.01 && recebido > 0 ? 'pago' : recebido > 0 ? 'parcial' : 'a_vencer' });
    }
    return { soma, devido };
  }
  const devido = Number(reg.valor_total || 0), aberto = Math.max(0, devido - soma);
  await db.NotaFiscal.update(id, { valor_recebido: soma, valor_aberto: aberto, status: soma > 0 && aberto <= 0.01 ? 'pago' : soma > 0 ? 'parcial' : 'a_vencer' });
  return { soma, devido };
}