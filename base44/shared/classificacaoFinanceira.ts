export const tiposCanonicos = ['estoque', 'despesas', 'impostos', 'folha', 'obras', 'pro_labore'];
export const origensCanonicas = ['empresa', 'condominio', 'investimento', 'pro_labore'];

export function resolverCadastro(cadastro = [], role = 'admin') {
  const permitidas = (eixo, fallback) => {
    const itens = cadastro.filter(item => item.eixo === eixo);
    if (!itens.length) return fallback;
    return itens.filter(item => item.ativo && (item.perfis_permitidos || []).includes(role)).map(item => item.chave);
  };
  return {
    origens: permitidas('origem', origensCanonicas),
    tipos: permitidas('tipo', tiposCanonicos),
    categorias: permitidas('categoria', []),
  };
}

const categoriaTipo = {
  fornecedor: 'estoque', estoque: 'estoque', produtos: 'estoque',
  tributo: 'impostos', despesa_operacional: 'despesas',
  obras_reforma: 'obras', pro_labore: 'pro_labore',
};
const eventosSemNatureza = new Set(['recebimento', 'transferencia', 'interno', 'saque', 'financeiro']);
const categoriasPessoais = new Set(['lazer', 'beleza', 'farmacia', 'saude_bem_estar', 'servico_pessoal']);

export function normalizarTexto(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\d+/g, ' ').replace(/[^a-z]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function chaveHistorica(entidade, registro) {
  const texto = registro.estabelecimento || registro.fornecedor || registro.descricao_produto || registro.descricao || registro.funcionario_nome || registro.tipo || '';
  return `${entidade}|${normalizarTexto(texto)}`;
}

export function construirMemoria(registrosPorEntidade, cadastro = [], role = 'admin') {
  const permitidos = resolverCadastro(cadastro, role);
  const contagens = new Map();
  for (const [entidade, registros] of Object.entries(registrosPorEntidade)) {
    for (const registro of registros) {
      const chave = chaveHistorica(entidade, registro);
      if (!chave.split('|')[1]) continue;
      const atual = contagens.get(chave) || { total: 0, origens: {}, tipos: {}, categorias: {} };
      atual.total += 1;
      if (permitidos.origens.includes(registro.origem_compra)) atual.origens[registro.origem_compra] = (atual.origens[registro.origem_compra] || 0) + 1;
      if (permitidos.tipos.includes(registro.tipo_compra)) atual.tipos[registro.tipo_compra] = (atual.tipos[registro.tipo_compra] || 0) + 1;
      if (registro.categoria) atual.categorias[registro.categoria] = (atual.categorias[registro.categoria] || 0) + 1;
      contagens.set(chave, atual);
    }
  }
  const memoria = new Map();
  for (const [chave, grupo] of contagens) {
    const vencedor = (valores) => Object.entries(valores).sort((a, b) => b[1] - a[1])[0];
    const origem = vencedor(grupo.origens); const tipo = vencedor(grupo.tipos); const categoria = vencedor(grupo.categorias);
    memoria.set(chave, {
      origem: origem?.[0], tipo: tipo?.[0], categoria: categoria?.[0],
      confiancaOrigem: origem ? Math.round(origem[1] / grupo.total * 100) : 0,
      confiancaTipo: tipo ? Math.round(tipo[1] / grupo.total * 100) : 0,
      confiancaCategoria: categoria ? Math.round(categoria[1] / grupo.total * 100) : 0,
      amostras: grupo.total,
    });
  }
  return memoria;
}

function eventoDoRegistro(entidade, registro) {
  if (entidade === 'FaturaCartao') return 'agrupador';
  if (entidade === 'LancamentoBancario') {
    if (Number(registro.valor) > 0) return registro.categoria === 'transferencia' ? 'transferencia' : 'receita';
    if (eventosSemNatureza.has(registro.categoria)) return registro.categoria;
    const texto = normalizarTexto(`${registro.descricao || ''} ${registro.detalhe || ''}`);
    if (/aplicacao|investimento|cdb|rdb|lci|lca|tesouro|poupanca|fundo|resgate/.test(texto)) return 'financeiro';
  }
  return 'gasto';
}

export function classificarRegistro(entidade, registro, memoria = new Map(), cadastro = [], role = 'admin') {
  const permitidos = resolverCadastro(cadastro, role);
  const antes = { origem_compra: registro.origem_compra || '', tipo_compra: registro.tipo_compra || '', categoria: registro.categoria || '' };
  const depois = { ...antes };
  const motivos = [];
  const historico = memoria.get(chaveHistorica(entidade, registro));
  const evento = eventoDoRegistro(entidade, registro);

  if (depois.origem_compra === 'pessoal') {
    depois.origem_compra = 'investimento'; motivos.push('centro de custo legado migrado para Investimento');
  } else if (!permitidos.origens.includes(depois.origem_compra)) {
    depois.origem_compra = historico?.confiancaOrigem >= 60 && permitidos.origens.includes(historico.origem) ? historico.origem : (permitidos.origens.includes('empresa') ? 'empresa' : permitidos.origens[0] || '');
    motivos.push(historico?.confiancaOrigem >= 60 ? 'centro de custo aprendido do histórico' : 'centro de custo padrão do cadastro mestre');
  }
  if (categoriasPessoais.has(depois.categoria) && entidade !== 'DespesaOperacional') {
    depois.origem_compra = 'investimento'; motivos.push('categoria pessoal direcionada para Investimento');
  }
  if (depois.categoria === 'pro_labore') {
    depois.origem_compra = 'pro_labore'; depois.tipo_compra = 'pro_labore'; motivos.push('conta analítica de pró-labore');
  }

  if (evento !== 'gasto') {
    if (depois.tipo_compra) motivos.push('evento sem impacto de natureza de gasto');
    depois.tipo_compra = '';
  } else if (depois.origem_compra === 'pro_labore') {
    depois.tipo_compra = 'pro_labore';
  } else if (entidade === 'Tributo') {
    depois.tipo_compra = 'impostos'; motivos.push('natureza definida pela origem Tributo');
  } else if (entidade === 'FolhaPagamento') {
    depois.tipo_compra = 'folha'; motivos.push('natureza definida pela origem Folha');
  } else if (entidade === 'ObraReforma') {
    depois.tipo_compra = registro.natureza === 'manutencao' ? 'despesas' : 'obras'; motivos.push('natureza definida pela política de obras');
  } else if (entidade === 'ItemCompra') {
    depois.tipo_compra = permitidos.tipos.includes(depois.tipo_compra) ? depois.tipo_compra : 'estoque'; motivos.push('natureza definida pela origem Compra');
  } else if (!permitidos.tipos.includes(depois.tipo_compra)) {
    const peloHistorico = historico?.confiancaTipo >= 60 ? historico.tipo : null;
    depois.tipo_compra = peloHistorico || categoriaTipo[depois.categoria] || (entidade === 'DespesaOperacional' || entidade === 'LancamentoCartao' ? 'despesas' : 'despesas');
    motivos.push(peloHistorico ? 'natureza aprendida do histórico' : categoriaTipo[depois.categoria] ? 'natureza derivada da conta analítica' : 'natureza padrão do módulo');
  }

  if (depois.tipo_compra && !permitidos.tipos.includes(depois.tipo_compra)) {
    depois.tipo_compra = '';
    motivos.push('natureza econômica inativa ou não permitida no cadastro mestre');
  }

  if (!depois.categoria && historico?.categoria && historico.confiancaCategoria >= 60 && (!permitidos.categorias.length || permitidos.categorias.includes(historico.categoria)) && ['LancamentoBancario', 'LancamentoCartao', 'DespesaOperacional'].includes(entidade)) {
    depois.categoria = historico.categoria; motivos.push('conta analítica aprendida do histórico');
  }
  if (depois.categoria && permitidos.categorias.length && !permitidos.categorias.includes(depois.categoria)) motivos.push('conta analítica pendente no cadastro mestre');
  const mudou = Object.keys(depois).some(campo => depois[campo] !== antes[campo]);
  const confiancas = [historico?.confiancaOrigem || 0, historico?.confiancaTipo || 0, historico?.confiancaCategoria || 0].filter(Boolean);
  const confianca = motivos.some(m => m.includes('definida pela origem') || m.includes('evento sem')) ? 100 : confiancas.length ? Math.max(...confiancas) : 70;
  return { evento, antes, depois, mudou, motivos, confianca };
}

export function validarCombinacao(entidade, registro, cadastro = [], role = 'admin') {
  const resultado = classificarRegistro(entidade, registro, new Map(), cadastro, role);
  const erros = [];
  if (resultado.evento !== 'gasto' && registro.tipo_compra) erros.push('Este evento financeiro não aceita natureza de gasto.');
  if (registro.origem_compra === 'pro_labore' && registro.tipo_compra !== 'pro_labore') erros.push('Pró-labore deve usar natureza Pró-labore nesta destinação.');
  return { valido: erros.length === 0, erros, normalizado: resultado.depois, evento: resultado.evento };
}