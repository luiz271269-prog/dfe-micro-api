import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CONNECTOR_ID = '69e4cc139c63e916cf87b922'; // Google Drive "Financeiro"

// ─── Parser XML simples (NF-e é bem estruturada, não precisa de DOM completo) ───
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

function parseNFe(xmlText) {
  // Remove namespace prefixes para simplificar (nfe:prod → prod)
  const xml = xmlText.replace(/<(\/?)[a-z0-9]+:/gi, '<$1');

  // Identificação
  const ide = tag(xml, 'ide');
  const emit = tag(xml, 'emit');
  const dest = tag(xml, 'dest');
  const total = tag(xml, 'total');
  const icmsTot = tag(total, 'ICMSTot');

  // Chave (atributo Id="NFe35...")
  const chaveMatch = xml.match(/Id="NFe(\d{44})"/);
  const chave = chaveMatch ? chaveMatch[1] : '';

  const result = {
    chave_acesso: chave,
    numero_nota: tag(ide, 'nNF'),
    serie: tag(ide, 'serie'),
    data_emissao: (tag(ide, 'dhEmi') || tag(ide, 'dEmi')).slice(0, 10),
    emitente_cnpj: tag(emit, 'CNPJ'),
    emitente_nome: tag(emit, 'xNome'),
    destinatario_cnpj: tag(dest, 'CNPJ') || tag(dest, 'CPF'),
    destinatario_nome: tag(dest, 'xNome'),
    valor_produtos: tagNum(icmsTot, 'vProd'),
    valor_frete: tagNum(icmsTot, 'vFrete'),
    valor_desconto: tagNum(icmsTot, 'vDesc'),
    valor_total: tagNum(icmsTot, 'vNF'),
    icms_total: tagNum(icmsTot, 'vICMS'),
    icms_st_total: tagNum(icmsTot, 'vST'),
    ipi_total: tagNum(icmsTot, 'vIPI'),
    pis_total: tagNum(icmsTot, 'vPIS'),
    cofins_total: tagNum(icmsTot, 'vCOFINS'),
    produtos: [],
  };

  // Produtos: cada <det nItem="N"> contém <prod> e <imposto>
  const dets = allBlocks(xml, 'det');
  for (const det of dets) {
    const prod = tag(det, 'prod');
    const imp = tag(det, 'imposto');
    const icms = tag(imp, 'ICMS');
    const ipi = tag(imp, 'IPI');
    const pis = tag(imp, 'PIS');
    const cofins = tag(imp, 'COFINS');

    result.produtos.push({
      codigo: tag(prod, 'cProd'),
      descricao: tag(prod, 'xProd'),
      ncm: tag(prod, 'NCM'),
      cfop: tag(prod, 'CFOP'),
      unidade: tag(prod, 'uCom'),
      quantidade: tagNum(prod, 'qCom'),
      valor_unitario: tagNum(prod, 'vUnCom'),
      valor_total: tagNum(prod, 'vProd'),
      icms_valor: tagNum(icms, 'vICMS'),
      icms_aliquota: tagNum(icms, 'pICMS'),
      ipi_valor: tagNum(ipi, 'vIPI'),
      pis_valor: tagNum(pis, 'vPIS'),
      cofins_valor: tagNum(cofins, 'vCOFINS'),
    });
  }

  return result;
}

// ─── Comparação com ItemCompra existente ───
function normalizar(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function compararComPedidos(nfe, itensCompra) {
  const divergencias = [];
  const matchIds = [];

  // Match por número da nota + fornecedor (mais confiável)
  const candidatos = itensCompra.filter(ic =>
    (ic.numero_nota && ic.numero_nota.replace(/^0+/, '') === nfe.numero_nota.replace(/^0+/, ''))
    || (normalizar(ic.fornecedor).includes(normalizar(nfe.emitente_nome).split(' ')[0])
        && ic.data_emissao === nfe.data_emissao)
  );

  if (candidatos.length === 0) {
    return { status: 'sem_pedido', item_compra_ids: [], divergencias: ['Nenhum pedido de compra encontrado para esta NF-e'] };
  }

  // Agrupar total do pedido vs total da NF-e
  const totalPedido = candidatos.reduce((s, c) => s + (c.valor_total || 0), 0);
  const diffValor = Math.abs(totalPedido - nfe.valor_produtos);
  if (diffValor > 1) {
    divergencias.push(`Valor divergente: pedido R$ ${totalPedido.toFixed(2)} vs NF-e R$ ${nfe.valor_produtos.toFixed(2)} (diff R$ ${diffValor.toFixed(2)})`);
  }

  // Verificar cada produto da NF-e
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
    }
  }

  let status = 'match_exato';
  if (divergencias.length > 0) {
    if (divergencias.some(d => d.includes('não encontrado'))) status = 'divergencia_produto';
    else if (divergencias.some(d => d.includes('qtd '))) status = 'divergencia_qtd';
    else status = 'divergencia_valor';
  }

  return { status, item_compra_ids: [...new Set(matchIds)], divergencias };
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

    // Pré-carrega pedidos de compra para comparação
    const itensCompra = await base44.asServiceRole.entities.ItemCompra.list('-data_emissao', 2000);

    const resultados = [];
    for (const fileId of file_ids) {
      try {
        // Metadados
        const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType`, { headers: authHeader });
        if (!metaRes.ok) {
          resultados.push({ file_id: fileId, error: `Metadados: ${metaRes.status}` });
          continue;
        }
        const meta = await metaRes.json();

        // Conteúdo
        const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: authHeader });
        if (!contentRes.ok) {
          resultados.push({ file_id: fileId, drive_file_name: meta.name, error: `Download: ${contentRes.status}` });
          continue;
        }
        const xmlText = await contentRes.text();

        // Parse
        const nfe = parseNFe(xmlText);
        if (!nfe.numero_nota) {
          resultados.push({ file_id: fileId, drive_file_name: meta.name, error: 'XML não parece ser NF-e válida' });
          continue;
        }

        // Comparação
        const cmp = compararComPedidos(nfe, itensCompra);

        // Dedup por chave_acesso
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
        };

        let saved;
        if (jaExiste) {
          saved = await base44.asServiceRole.entities.NFeAnalise.update(jaExiste.id, payload);
        } else {
          saved = await base44.asServiceRole.entities.NFeAnalise.create(payload);
        }
        resultados.push({ file_id: fileId, drive_file_name: meta.name, status: cmp.status, divergencias: cmp.divergencias.length, nfe_analise_id: saved.id });
      } catch (e) {
        resultados.push({ file_id: fileId, error: e.message });
      }
    }

    return Response.json({ processados: resultados.length, resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});