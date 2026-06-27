import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const CONNECTOR_ID = '69e4cc139c63e916cf87b922'; // Google Drive "Financeiro"

// ─── Parser XML auxiliares ───
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
  return m ? m[1].trim() : '';
}
function tagNum(xml, name) {
  const v = tag(xml, name);
  return v ? parseFloat(v) : 0;
}
function allBlocks(xml, name) {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

// ─── Conhecimento tributário (baseado em legislação vigente) ───
// CFOPs de entrada e suas categorias
const CFOP_CATEGORIAS = {
  // 1xxx/2xxx = entrada, 5xxx/6xxx = saída
  '1102': 'compra_revenda_uf', '2102': 'compra_revenda_interestadual',
  '1101': 'compra_industrializacao_uf', '2101': 'compra_industrializacao_interestadual',
  '1556': 'compra_uso_consumo', '2556': 'compra_uso_consumo_interestadual',
  '1551': 'compra_ativo_imobilizado', '2551': 'compra_ativo_imobilizado_interestadual',
  '1403': 'compra_revenda_st', '2403': 'compra_revenda_st_interestadual',
  '1910': 'entrada_bonificacao', '2910': 'entrada_bonificacao_interestadual',
};

// CSTs ICMS válidos (Simples Nacional usa CSOSN 101..900, regime normal usa 00..90)
const CST_ICMS_SIMPLES = ['101', '102', '103', '201', '202', '203', '300', '400', '500', '900'];
const CST_ICMS_NORMAL = ['00', '10', '20', '30', '40', '41', '50', '51', '60', '70', '90'];

// CSTs PIS/COFINS
const CST_PIS_COFINS_VALIDOS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '49', '50', '51', '52', '53', '54', '55', '56', '60', '61', '62', '63', '64', '65', '66', '67', '70', '71', '72', '73', '74', '75', '98', '99'];

// Alíquotas ICMS interestaduais (origem → destino, produtos nacionais)
// Para PR (onde empresa geralmente está): de SP/MG/RJ para PR = 12%; do S/SE para N/NE/CO/ES = 7%
function aliquotaICMSInterestadualEsperada(ufOrigem, ufDestino) {
  const S_SE = ['SP', 'MG', 'RJ', 'RS', 'SC', 'PR'];
  const origemDesenvolvida = S_SE.includes(ufOrigem);
  const destinoDesenvolvido = S_SE.includes(ufDestino);
  if (origemDesenvolvida && destinoDesenvolvido) return 12;
  if (origemDesenvolvida && !destinoDesenvolvido) return 7;
  return 12; // destino desenvolvido ou ambos em outra região
}

// Determina regime tributário do emitente a partir de pistas do XML
function detectarRegime(xml, emit) {
  const crt = tag(emit, 'CRT'); // 1=Simples, 2=Simples excesso sublimite, 3=Regime Normal, 4=MEI
  if (crt === '1' || crt === '2') return 'simples_nacional';
  if (crt === '3') return 'lucro_presumido_real';
  if (crt === '4') return 'mei';
  // fallback: se houver CSOSN em algum det, é Simples
  if (xml.includes('<CSOSN>')) return 'simples_nacional';
  if (xml.includes('<CST>')) return 'lucro_presumido_real';
  return 'desconhecido';
}

// Valida conformidade fiscal de um produto
function avaliarConformidadeProduto(p, ctx) {
  const alertas = [];
  let score = 100;

  // 1. NCM
  if (!p.ncm || p.ncm.length !== 8) {
    alertas.push(`NCM inválido ou ausente (${p.ncm || 'vazio'}) — obrigatório 8 dígitos`);
    score -= 20;
  } else if (p.ncm === '00000000') {
    alertas.push('NCM genérico (00000000) — exige fundamentação legal específica');
    score -= 10;
  }

  // 2. CFOP
  if (!p.cfop || p.cfop.length !== 4) {
    alertas.push(`CFOP inválido (${p.cfop || 'vazio'})`);
    score -= 15;
  } else {
    const primeiro = p.cfop[0];
    const esperadoInterestadual = ctx.operacao_interestadual;
    if (esperadoInterestadual && !['2', '3', '6', '7'].includes(primeiro)) {
      alertas.push(`CFOP ${p.cfop} inconsistente: operação interestadual deveria iniciar com 2 ou 6`);
      score -= 10;
    }
    if (!esperadoInterestadual && !['1', '5'].includes(primeiro)) {
      alertas.push(`CFOP ${p.cfop} inconsistente: operação interna deveria iniciar com 1 ou 5`);
      score -= 10;
    }
  }

  // 3. CST ICMS coerente com regime
  if (p.cst_icms) {
    const isSimples = /^\d{3}$/.test(p.cst_icms); // CSOSN tem 3 dígitos (ex: 101)
    const isNormal = /^\d{2}$/.test(p.cst_icms);  // CST normal tem 2 dígitos
    if (ctx.regime === 'simples_nacional' && !isSimples) {
      alertas.push(`Emitente é Simples Nacional mas CST ICMS "${p.cst_icms}" parece ser do regime normal (esperado CSOSN 3 dígitos)`);
      score -= 10;
    }
    if (ctx.regime === 'lucro_presumido_real' && !isNormal) {
      alertas.push(`Emitente é regime normal mas CST ICMS "${p.cst_icms}" parece ser CSOSN (esperado 2 dígitos)`);
      score -= 10;
    }
    const listaValida = isSimples ? CST_ICMS_SIMPLES : CST_ICMS_NORMAL;
    if (isSimples || isNormal) {
      if (!listaValida.includes(p.cst_icms)) {
        alertas.push(`CST/CSOSN "${p.cst_icms}" não consta na lista oficial`);
        score -= 5;
      }
    }
  }

  // 4. PIS/COFINS consistência
  if (p.cst_pis && p.cst_cofins && p.cst_pis !== p.cst_cofins) {
    alertas.push(`CST PIS (${p.cst_pis}) difere de CST COFINS (${p.cst_cofins}) — geralmente devem ser iguais`);
    score -= 5;
  }
  if (p.cst_pis && !CST_PIS_COFINS_VALIDOS.includes(p.cst_pis)) {
    alertas.push(`CST PIS "${p.cst_pis}" inválido`);
    score -= 5;
  }

  // 5. Validação aritmética ICMS (base × alíquota = valor)
  if (p.icms_base > 0 && p.icms_aliquota > 0) {
    const esperado = p.icms_base * p.icms_aliquota / 100;
    const diff = Math.abs(esperado - p.icms_valor);
    if (diff > 0.02 && (diff / (p.icms_valor || 1)) > 0.01) {
      alertas.push(`ICMS aritmético: ${p.icms_base.toFixed(2)} × ${p.icms_aliquota}% = ${esperado.toFixed(2)}, mas XML traz ${p.icms_valor.toFixed(2)}`);
      score -= 8;
    }
  }

  // 6. Alíquota ICMS interestadual esperada
  if (ctx.operacao_interestadual && p.icms_aliquota > 0 && ctx.uf_origem && ctx.uf_destino) {
    const esperadaAliq = aliquotaICMSInterestadualEsperada(ctx.uf_origem, ctx.uf_destino);
    if (Math.abs(p.icms_aliquota - esperadaAliq) > 0.1 && !['4', '7'].includes(Math.floor(p.icms_aliquota).toString())) {
      alertas.push(`Alíquota ICMS ${p.icms_aliquota}% atípica para ${ctx.uf_origem}→${ctx.uf_destino} (esperado ~${esperadaAliq}% ou 4% p/ importado)`);
      score -= 5;
    }
  }

  // 7. ICMS-ST: se CFOP indicar ST (1403/2403/1405), valor ST deve existir
  if (['1403', '2403', '1405', '2405'].includes(p.cfop) && p.icms_st_valor === 0) {
    alertas.push(`CFOP ${p.cfop} indica substituição tributária, mas vICMSST=0`);
    score -= 10;
  }

  return {
    score: Math.max(0, score),
    alertas,
    cfop_categoria: CFOP_CATEGORIAS[p.cfop] || (p.cfop ? `cfop_${p.cfop}` : 'desconhecido'),
  };
}

// Extrai TODOS os campos fiscais de um <det>
function parseDet(det) {
  const prod = tag(det, 'prod');
  const imp = tag(det, 'imposto');
  const icmsBlock = tag(imp, 'ICMS');
  const ipiBlock = tag(imp, 'IPI');
  const pisBlock = tag(imp, 'PIS');
  const cofinsBlock = tag(imp, 'COFINS');

  // Dentro de ICMS, pode haver ICMS00, ICMS10, ICMSSN101 etc. Pegamos o primeiro sub-bloco.
  const icmsSub = icmsBlock.match(/<(ICMS\w+|CSOSN\w*)[^>]*>([\s\S]*?)<\/\1>/);
  const icms = icmsSub ? icmsSub[2] : icmsBlock;
  const ipiTrib = tag(ipiBlock, 'IPITrib') || ipiBlock;
  const pisSub = pisBlock.match(/<(PIS\w+)[^>]*>([\s\S]*?)<\/\1>/);
  const pis = pisSub ? pisSub[2] : pisBlock;
  const cofinsSub = cofinsBlock.match(/<(COFINS\w+)[^>]*>([\s\S]*?)<\/\1>/);
  const cofins = cofinsSub ? cofinsSub[2] : cofinsBlock;

  const valorTotal = tagNum(prod, 'vProd');
  const totalTrib = tag(imp, 'vTotTrib');

  return {
    codigo: tag(prod, 'cProd'),
    descricao: tag(prod, 'xProd'),
    ncm: tag(prod, 'NCM'),
    cfop: tag(prod, 'CFOP'),
    unidade: tag(prod, 'uCom'),
    quantidade: tagNum(prod, 'qCom'),
    valor_unitario: tagNum(prod, 'vUnCom'),
    valor_total: valorTotal,
    cst_icms: tag(icms, 'CST') || tag(icms, 'CSOSN'),
    origem_mercadoria: tag(icms, 'orig'),
    icms_base: tagNum(icms, 'vBC'),
    icms_aliquota: tagNum(icms, 'pICMS'),
    icms_valor: tagNum(icms, 'vICMS'),
    icms_st_base: tagNum(icms, 'vBCST'),
    icms_st_aliquota: tagNum(icms, 'pICMSST'),
    icms_st_valor: tagNum(icms, 'vICMSST'),
    cst_ipi: tag(ipiTrib, 'CST'),
    ipi_aliquota: tagNum(ipiTrib, 'pIPI'),
    ipi_valor: tagNum(ipiTrib, 'vIPI'),
    cst_pis: tag(pis, 'CST'),
    pis_aliquota: tagNum(pis, 'pPIS'),
    pis_valor: tagNum(pis, 'vPIS'),
    cst_cofins: tag(cofins, 'CST'),
    cofins_aliquota: tagNum(cofins, 'pCOFINS'),
    cofins_valor: tagNum(cofins, 'vCOFINS'),
    tributo_aproximado: totalTrib ? parseFloat(totalTrib) : 0,
  };
}

function parseNFe(xmlText) {
  const xml = xmlText.replace(/<(\/?)[a-z0-9]+:/gi, '<$1');

  const ide = tag(xml, 'ide');
  const emit = tag(xml, 'emit');
  const dest = tag(xml, 'dest');
  const total = tag(xml, 'total');
  const icmsTot = tag(total, 'ICMSTot');

  const chaveMatch = xml.match(/Id="NFe(\d{44})"/);
  const chave = chaveMatch ? chaveMatch[1] : '';

  const emitUF = tag(tag(emit, 'enderEmit'), 'UF');
  const destUF = tag(tag(dest, 'enderDest'), 'UF');
  const regime = detectarRegime(xml, emit);
  const interestadual = emitUF && destUF && emitUF !== destUF;

  const result = {
    chave_acesso: chave,
    numero_nota: tag(ide, 'nNF'),
    serie: tag(ide, 'serie'),
    natureza_operacao: tag(ide, 'natOp'),
    data_emissao: (tag(ide, 'dhEmi') || tag(ide, 'dEmi')).slice(0, 10),
    emitente_cnpj: tag(emit, 'CNPJ'),
    emitente_nome: tag(emit, 'xNome'),
    emitente_uf: emitUF,
    emitente_regime: regime,
    destinatario_cnpj: tag(dest, 'CNPJ') || tag(dest, 'CPF'),
    destinatario_nome: tag(dest, 'xNome'),
    destinatario_uf: destUF,
    operacao_interestadual: interestadual,
    valor_produtos: tagNum(icmsTot, 'vProd'),
    valor_frete: tagNum(icmsTot, 'vFrete'),
    valor_desconto: tagNum(icmsTot, 'vDesc'),
    valor_outras_despesas: tagNum(icmsTot, 'vOutro'),
    valor_total: tagNum(icmsTot, 'vNF'),
    icms_base: tagNum(icmsTot, 'vBC'),
    icms_total: tagNum(icmsTot, 'vICMS'),
    icms_st_base: tagNum(icmsTot, 'vBCST'),
    icms_st_total: tagNum(icmsTot, 'vST'),
    ipi_total: tagNum(icmsTot, 'vIPI'),
    pis_total: tagNum(icmsTot, 'vPIS'),
    cofins_total: tagNum(icmsTot, 'vCOFINS'),
    tributos_aproximados: tagNum(icmsTot, 'vTotTrib'),
    produtos: [],
  };

  const ctx = {
    regime,
    operacao_interestadual: interestadual,
    uf_origem: emitUF,
    uf_destino: destUF,
  };

  const dets = allBlocks(xml, 'det');
  for (const det of dets) {
    const prod = parseDet(det);
    prod.conformidade_fiscal = avaliarConformidadeProduto(prod, ctx);
    result.produtos.push(prod);
  }

  return result;
}

// ─── Avaliação de conformidade geral da NF-e ───
function avaliarConformidadeNFe(nfe) {
  const alertas = [];
  let score = 100;

  // Média dos scores dos produtos
  if (nfe.produtos.length > 0) {
    const mediaProds = nfe.produtos.reduce((s, p) => s + (p.conformidade_fiscal?.score || 100), 0) / nfe.produtos.length;
    score = Math.round(mediaProds);
  }

  // Soma dos valores de produtos vs total
  const somaProds = nfe.produtos.reduce((s, p) => s + p.valor_total, 0);
  if (Math.abs(somaProds - nfe.valor_produtos) > 0.5) {
    alertas.push(`Soma dos produtos (${somaProds.toFixed(2)}) difere do total declarado (${nfe.valor_produtos.toFixed(2)})`);
    score -= 10;
  }

  // Soma impostos vs total de impostos da NF
  const somaICMS = nfe.produtos.reduce((s, p) => s + p.icms_valor, 0);
  if (Math.abs(somaICMS - nfe.icms_total) > 0.5) {
    alertas.push(`Soma ICMS dos produtos (${somaICMS.toFixed(2)}) difere do ICMS total declarado (${nfe.icms_total.toFixed(2)})`);
    score -= 5;
  }

  // Validação NF total = produtos + frete + outras - descontos + ICMS-ST + IPI
  const calcTotal = nfe.valor_produtos + nfe.valor_frete + nfe.valor_outras_despesas - nfe.valor_desconto + nfe.icms_st_total + nfe.ipi_total;
  if (Math.abs(calcTotal - nfe.valor_total) > 1) {
    alertas.push(`Valor total inconsistente: calculado ${calcTotal.toFixed(2)} vs declarado ${nfe.valor_total.toFixed(2)}`);
    score -= 10;
  }

  // Simples Nacional não destaca ICMS (exceto CSOSN 201..203 e 900)
  if (nfe.emitente_regime === 'simples_nacional' && nfe.icms_total > 0) {
    const destacaPermitido = nfe.produtos.some(p => ['201', '202', '203', '900'].includes(p.cst_icms));
    if (!destacaPermitido) {
      alertas.push('Simples Nacional destacando ICMS sem CSOSN 201/202/203/900 — revisar');
      score -= 8;
    }
  }

  return { score: Math.max(0, Math.min(100, score)), alertas };
}

// ─── Comparação com ItemCompra ───
function normalizar(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function compararComPedidos(nfe, itensCompra) {
  const divergencias = [];
  const divergenciasFiscais = [];
  const matchIds = [];

  const candidatos = itensCompra.filter(ic =>
    (ic.numero_nota && ic.numero_nota.replace(/^0+/, '') === nfe.numero_nota.replace(/^0+/, ''))
    || (normalizar(ic.fornecedor).includes(normalizar(nfe.emitente_nome).split(' ')[0])
        && ic.data_emissao === nfe.data_emissao)
  );

  if (candidatos.length === 0) {
    return { status: 'sem_pedido', item_compra_ids: [], divergencias: ['Nenhum pedido de compra encontrado para esta NF-e'], divergencias_fiscais: [] };
  }

  const totalPedido = candidatos.reduce((s, c) => s + (c.valor_total || 0), 0);
  const diffValor = Math.abs(totalPedido - nfe.valor_produtos);
  if (diffValor > 1) {
    divergencias.push(`Valor divergente: pedido R$ ${totalPedido.toFixed(2)} vs NF-e R$ ${nfe.valor_produtos.toFixed(2)} (diff R$ ${diffValor.toFixed(2)})`);
  }

  for (const p of nfe.produtos) {
    const ic = candidatos.find(c =>
      normalizar(c.descricao_produto).includes(normalizar(p.descricao).slice(0, 15))
      || (c.codigo_produto && c.codigo_produto === p.codigo)
    );
    if (!ic) {
      divergencias.push(`Produto "${p.descricao}" (${p.codigo}) não encontrado no pedido`);
      continue;
    }
    matchIds.push(ic.id);
    if (Math.abs((ic.quantidade || 1) - p.quantidade) > 0.01) {
      divergencias.push(`${p.descricao}: qtd pedido ${ic.quantidade} vs NF-e ${p.quantidade}`);
    }
    if (Math.abs((ic.valor_total || 0) - p.valor_total) > 0.5) {
      divergencias.push(`${p.descricao}: valor pedido R$ ${(ic.valor_total || 0).toFixed(2)} vs NF-e R$ ${p.valor_total.toFixed(2)}`);
      divergenciasFiscais.push({
        tipo: 'valor_produto',
        produto: p.descricao,
        campo: 'valor_total',
        esperado: (ic.valor_total || 0).toFixed(2),
        encontrado: p.valor_total.toFixed(2),
        severidade: 'alta',
        observacao: 'Valor na NF-e difere do pedido — revisar preço negociado vs cobrado',
      });
    }
    // Alertas fiscais do produto viram divergencias_fiscais
    (p.conformidade_fiscal?.alertas || []).forEach(msg => {
      divergenciasFiscais.push({
        tipo: 'conformidade_fiscal',
        produto: p.descricao,
        campo: 'fiscal',
        esperado: '',
        encontrado: '',
        severidade: msg.includes('inválido') || msg.includes('ausente') ? 'alta' : 'media',
        observacao: msg,
      });
    });
  }

  let status = 'match_exato';
  if (divergencias.length > 0) {
    if (divergencias.some(d => d.includes('não encontrado'))) status = 'divergencia_produto';
    else if (divergencias.some(d => d.includes('qtd '))) status = 'divergencia_qtd';
    else status = 'divergencia_valor';
  }

  return { status, item_compra_ids: [...new Set(matchIds)], divergencias, divergencias_fiscais: divergenciasFiscais };
}

// ─── Handler ───
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_ids } = await req.json();
    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      return Response.json({ error: 'file_ids obrigatório (array)' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const itensCompra = await base44.asServiceRole.entities.ItemCompra.list('-data_emissao', 2000);

    const resultados = [];
    for (const fileId of file_ids) {
      try {
        const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType`, { headers: authHeader });
        if (!metaRes.ok) {
          resultados.push({ file_id: fileId, error: `Metadados: ${metaRes.status}` });
          continue;
        }
        const meta = await metaRes.json();

        const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: authHeader });
        if (!contentRes.ok) {
          resultados.push({ file_id: fileId, drive_file_name: meta.name, error: `Download: ${contentRes.status}` });
          continue;
        }
        const xmlText = await contentRes.text();

        const nfe = parseNFe(xmlText);
        if (!nfe.numero_nota) {
          resultados.push({ file_id: fileId, drive_file_name: meta.name, error: 'XML não parece ser NF-e válida' });
          continue;
        }

        const confGeral = avaliarConformidadeNFe(nfe);
        const cmp = compararComPedidos(nfe, itensCompra);

        const jaExiste = nfe.chave_acesso
          ? (await base44.asServiceRole.entities.NFeAnalise.filter({ chave_acesso: nfe.chave_acesso }))[0]
          : null;

        const payload = {
          drive_file_id: fileId,
          drive_file_name: meta.name,
          ...nfe,
          status_comparacao: cmp.status,
          item_compra_ids: cmp.item_compra_ids,
          divergencias: cmp.divergencias,
          divergencias_fiscais: cmp.divergencias_fiscais,
          score_conformidade: confGeral.score,
          alertas_conformidade: confGeral.alertas,
        };

        let saved;
        if (jaExiste) {
          saved = await base44.asServiceRole.entities.NFeAnalise.update(jaExiste.id, payload);
        } else {
          saved = await base44.asServiceRole.entities.NFeAnalise.create(payload);
        }
        resultados.push({
          file_id: fileId,
          drive_file_name: meta.name,
          status: cmp.status,
          divergencias: cmp.divergencias.length,
          divergencias_fiscais: cmp.divergencias_fiscais.length,
          score_conformidade: confGeral.score,
          nfe_analise_id: saved.id,
        });
      } catch (e) {
        resultados.push({ file_id: fileId, error: e.message });
      }
    }

    return Response.json({ processados: resultados.length, resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});