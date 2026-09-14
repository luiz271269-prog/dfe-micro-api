// Regime de competência — Resultado da Operação (decisões 1, 2, 3, 9, 12).
import { linha, noMes, dentroPerimetro, arred, semEmpresa } from './evidencia.ts';

const TIPOS_EXTERNOS_FATURAVEIS = ['contrato_locacao', 'ordem_servico', 'contrato_assistencia'];
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const diasEntre = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

export function calcularOperacao(dados, mes, perimetro) {
  const nfs = dados.NotaFiscal.filter((n) => noMes(n.data_emissao, mes) && n.status !== 'anulada' && !n.is_espelho_ci && dentroPerimetro(n.empresa, perimetro));

  // decisão 8 (fallback): fato externo duplica NF se contraparte + valor ± 0,01 + data ± 3 dias coincidem
  const externos = dados.IntegracaoFinanceira.filter((i) => TIPOS_EXTERNOS_FATURAVEIS.includes(i.tipo_registro) && noMes(i.data_referencia, mes) && dentroPerimetro(i.empresa, perimetro));
  const duplicados = [];
  const externosValidos = externos.filter((i) => {
    const dup = nfs.some((n) => norm(n.cliente) === norm(i.contraparte) && Math.abs((n.valor_total || 0) - (i.valor || 0)) <= 0.01 && diasEntre(n.data_emissao, i.data_referencia) <= 3);
    if (dup) duplicados.push(i.id);
    return !dup;
  });

  const vendasNF = linha(nfs, (n) => n.valor_total, { entidade: 'NotaFiscal', regime: 'competencia', rotulo: 'Vendas (NF)' });
  const externosLinha = linha(externosValidos, (i) => i.valor, { entidade: 'IntegracaoFinanceira', regime: 'competencia', rotulo: 'Locações / OS / Assistência', deduplicados: duplicados });
  const porTipo = (tipos, rotulo) => linha(externosValidos.filter((i) => tipos.includes(i.tipo_registro)), (i) => i.valor, { entidade: 'IntegracaoFinanceira', regime: 'competencia', rotulo });
  const fontes = {
    produtos: { ...vendasNF, rotulo: 'Produtos (NF)' },
    servicos: porTipo(['ordem_servico', 'contrato_assistencia'], 'Serviços / Assistência'),
    locacoes: porTipo(['contrato_locacao'], 'Locações'),
  };
  const faturamento = { valor: arred(vendasNF.valor + externosLinha.valor), componentes: { vendasNF, externos: externosLinha }, fontes };

  const cmvEstimado = linha(
    dados.ItemCompra.filter((c) => noMes(c.data_emissao, mes) && c.tipo_compra === 'estoque' && dentroPerimetro(c.empresa, perimetro)),
    (c) => c.valor_total,
    { entidade: 'ItemCompra', regime: 'competencia', rotulo: 'Custo de mercadorias — estimativa por compras', confianca: 'estimado' },
  );
  const tributosMes = dados.Tributo.filter((t) => t.competencia === mes && dentroPerimetro(t.empresa, perimetro));
  const tributos = {
    ...linha(tributosMes, (t) => t.valor_original, { entidade: 'Tributo', regime: 'competencia', rotulo: 'Impostos da operação' }),
    componentes: {
      das: linha(tributosMes.filter((t) => t.tipo === 'DAS'), (t) => t.valor_original, { entidade: 'Tributo', regime: 'competencia', rotulo: 'DAS' }),
      outros: linha(tributosMes.filter((t) => t.tipo !== 'DAS'), (t) => t.valor_original, { entidade: 'Tributo', regime: 'competencia', rotulo: 'Outros tributos' }),
    },
  };
  const folha = linha(
    dados.FolhaPagamento.filter((f) => f.competencia === mes && f.origem_compra !== 'pro_labore' && dentroPerimetro(f.empresa, perimetro)),
    (f) => f.salario_liquido, { entidade: 'FolhaPagamento', regime: 'competencia', rotulo: 'Folha operacional' },
  );
  const despesasOp = dados.DespesaOperacional.filter((d) => noMes(d.data, mes) && d.origem_compra !== 'pro_labore' && dentroPerimetro(d.empresa, perimetro));
  const obrasManutencao = dados.ObraReforma.filter((o) => noMes(o.data, mes) && o.natureza === 'manutencao');
  const despesas = {
    ...linha([...despesasOp, ...obrasManutencao], (d) => d.valor, { regime: 'competencia', rotulo: 'Despesas operacionais' }),
    entidade: 'DespesaOperacional+ObraReforma(manutencao)',
    componentes: {
      despesasOp: linha(despesasOp, (d) => d.valor, { entidade: 'DespesaOperacional', regime: 'competencia', rotulo: 'Outras despesas operacionais' }),
      obrasManutencao: linha(obrasManutencao, (o) => o.valor, { entidade: 'ObraReforma', regime: 'competencia', rotulo: 'Manutenção (obras)' }),
    },
  };

  const custosFixos = arred(despesasOp.filter((d) => d.recorrente).reduce((s, d) => s + (d.valor || 0), 0) + folha.valor);
  const resultado = arred(faturamento.valor - cmvEstimado.valor - tributos.valor - folha.valor - despesas.valor);

  // Loop-R: registros do mês sem empresa — contados no grupo, mas nunca certificáveis por perímetro.
  const pendenteEmpresa = linha(
    [
      ...semEmpresa(dados.NotaFiscal.filter((n) => noMes(n.data_emissao, mes) && n.status !== 'anulada' && !n.is_espelho_ci)).map((n) => ({ ...n, _v: n.valor_total })),
      ...semEmpresa(dados.IntegracaoFinanceira.filter((i) => TIPOS_EXTERNOS_FATURAVEIS.includes(i.tipo_registro) && noMes(i.data_referencia, mes))).map((i) => ({ ...i, _v: i.valor })),
      ...semEmpresa(dados.ItemCompra.filter((c) => noMes(c.data_emissao, mes) && c.tipo_compra === 'estoque')).map((c) => ({ ...c, _v: c.valor_total })),
      ...semEmpresa(dados.Tributo.filter((t) => t.competencia === mes)).map((t) => ({ ...t, _v: t.valor_original })),
      ...semEmpresa(dados.FolhaPagamento.filter((f) => f.competencia === mes)).map((f) => ({ ...f, _v: f.salario_liquido })),
      ...semEmpresa(dados.DespesaOperacional.filter((d) => noMes(d.data, mes))).map((d) => ({ ...d, _v: d.valor })),
    ],
    (r) => r._v,
    { regime: 'competencia', rotulo: 'Pendente de empresa', confianca: 'nao_certificavel' },
  );

  return {
    faturamento, cmvEstimado, tributos, folha, despesas, resultado, pendenteEmpresa,
    margemOperacional: faturamento.valor ? arred((resultado / faturamento.valor) * 100) : null,
    custosFixos: { valor: custosFixos, rotulo: 'Custos Fixos', observacao: 'Não é ponto de equilíbrio (decisão 3).' },
  };
}