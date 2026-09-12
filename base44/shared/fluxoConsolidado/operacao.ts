// Regime de competência — Resultado da Operação (decisões 1, 2, 3, 9, 12).
import { linha, noMes, dentroPerimetro, arred } from './evidencia.ts';

const TIPOS_EXTERNOS_FATURAVEIS = ['contrato_locacao', 'ordem_servico', 'contrato_assistencia'];
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const diasEntre = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

export function calcularOperacao(dados, mes, perimetro) {
  const nfs = dados.NotaFiscal.filter((n) => noMes(n.data_emissao, mes) && n.status !== 'anulada' && !n.is_espelho_ci && dentroPerimetro(n.empresa, perimetro));

  // decisão 8 (fallback): fato externo duplica NF se contraparte + valor ± 0,01 + data ± 3 dias coincidem
  const externos = dados.IntegracaoFinanceira.filter((i) => TIPOS_EXTERNOS_FATURAVEIS.includes(i.tipo_registro) && noMes(i.data_referencia, mes));
  const duplicados = [];
  const externosValidos = externos.filter((i) => {
    const dup = nfs.some((n) => norm(n.cliente) === norm(i.contraparte) && Math.abs((n.valor_total || 0) - (i.valor || 0)) <= 0.01 && diasEntre(n.data_emissao, i.data_referencia) <= 3);
    if (dup) duplicados.push(i.id);
    return !dup;
  });

  const vendasNF = linha(nfs, (n) => n.valor_total, { entidade: 'NotaFiscal', regime: 'competencia', rotulo: 'Vendas (NF)' });
  const externosLinha = linha(externosValidos, (i) => i.valor, { entidade: 'IntegracaoFinanceira', regime: 'competencia', rotulo: 'Locações / OS / Assistência', deduplicados: duplicados });
  const faturamento = { valor: arred(vendasNF.valor + externosLinha.valor), componentes: { vendasNF, externos: externosLinha } };

  const cmvEstimado = linha(
    dados.ItemCompra.filter((c) => noMes(c.data_emissao, mes) && c.tipo_compra === 'estoque'),
    (c) => c.valor_total,
    { entidade: 'ItemCompra', regime: 'competencia', rotulo: 'Custo de mercadorias — estimativa por compras', confianca: 'estimado' },
  );
  const tributos = linha(
    dados.Tributo.filter((t) => t.competencia === mes && dentroPerimetro(t.empresa, perimetro)),
    (t) => t.valor_original, { entidade: 'Tributo', regime: 'competencia', rotulo: 'Impostos da operação' },
  );
  const folha = linha(
    dados.FolhaPagamento.filter((f) => f.competencia === mes && f.origem_compra !== 'pro_labore' && dentroPerimetro(f.empresa, perimetro)),
    (f) => f.salario_liquido, { entidade: 'FolhaPagamento', regime: 'competencia', rotulo: 'Folha operacional' },
  );
  const despesasOp = dados.DespesaOperacional.filter((d) => noMes(d.data, mes) && d.origem_compra !== 'pro_labore' && dentroPerimetro(d.empresa, perimetro));
  const obrasManutencao = dados.ObraReforma.filter((o) => noMes(o.data, mes) && o.natureza === 'manutencao');
  const despesas = {
    ...linha([...despesasOp, ...obrasManutencao], (d) => d.valor, { regime: 'competencia', rotulo: 'Despesas operacionais' }),
    entidade: 'DespesaOperacional+ObraReforma(manutencao)',
  };

  const custosFixos = arred(despesasOp.filter((d) => d.recorrente).reduce((s, d) => s + (d.valor || 0), 0) + folha.valor);
  const resultado = arred(faturamento.valor - cmvEstimado.valor - tributos.valor - folha.valor - despesas.valor);

  return {
    faturamento, cmvEstimado, tributos, folha, despesas, resultado,
    margemOperacional: faturamento.valor ? arred((resultado / faturamento.valor) * 100) : null,
    custosFixos: { valor: custosFixos, rotulo: 'Custos Fixos', observacao: 'Não é ponto de equilíbrio (decisão 3).' },
  };
}