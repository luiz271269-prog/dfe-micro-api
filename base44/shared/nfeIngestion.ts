const MAX_XML_BYTES = 10 * 1024 * 1024;

function decodeBase64(value) {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function xmlDoDocumento(documento) {
  if (documento.xml_base64) return new TextDecoder().decode(decodeBase64(documento.xml_base64));
  const bytes = decodeBase64(documento.data || '');
  const reader = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_XML_BYTES) throw new Error('XML descompactado excede 10 MB.');
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

function parseLegado(xml) {
  const pick = (regex) => xml.match(regex)?.[1] || null;
  const numeric = (value) => value === null ? null : Number(value);
  return {
    chave_acesso: pick(/<chNFe>(\d{44})<\/chNFe>/) || pick(/Id="NFe(\d{44})"/),
    tipo_documento: /<resNFe/i.test(xml) ? 'nfe_resumo' : 'nfe',
    numero_nota: pick(/<nNF>([^<]+)<\/nNF>/), serie: pick(/<serie>([^<]+)<\/serie>/),
    data_emissao: pick(/<dhEmi>([^<]+)<\/dhEmi>/) || pick(/<dEmi>([^<]+)<\/dEmi>/),
    natureza_operacao: pick(/<natOp>([^<]+)<\/natOp>/),
    emitente: { cnpj: pick(/<emit>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/) || pick(/<CNPJ>(\d+)<\/CNPJ>/), nome: pick(/<emit>[\s\S]*?<xNome>([^<]+)<\/xNome>/) || pick(/<xNome>([^<]+)<\/xNome>/), uf: pick(/<emit>[\s\S]*?<UF>([^<]+)<\/UF>/) },
    destinatario: { cnpj: pick(/<dest>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/) },
    totais: { valor_total: numeric(pick(/<vNF>([^<]+)<\/vNF>/)), valor_produtos: numeric(pick(/<ICMSTot>[\s\S]*?<vProd>([^<]+)<\/vProd>/)), valor_icms: numeric(pick(/<ICMSTot>[\s\S]*?<vICMS>([^<]+)<\/vICMS>/)), valor_icms_st: numeric(pick(/<ICMSTot>[\s\S]*?<vST>([^<]+)<\/vST>/)), valor_ipi: numeric(pick(/<ICMSTot>[\s\S]*?<vIPI>([^<]+)<\/vIPI>/)) },
  };
}

export async function ingestirDocumentoNFe(base44, { documento, empresa = 'NeuralTec', origem = 'real', cnpjDestinatario }) {
  const xml = await xmlDoDocumento(documento);
  const dados = documento.dados_estruturados || parseLegado(xml);
  if (!dados.chave_acesso) throw new Error(`Documento NSU ${documento.nsu || 'sem NSU'} sem chave de acesso.`);
  const existente = await base44.asServiceRole.entities.NFeRecebida.filter({ chave_acesso: dados.chave_acesso, origem_documento: origem });
  if (existente?.length) return { status: 'duplicado', id: existente[0].id, chave: dados.chave_acesso };

  const file = new File([xml], `${dados.chave_acesso}.xml`, { type: 'application/xml' });
  const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
  const manifestada = documento.manifestacao?.ok === true;
  const record = await base44.asServiceRole.entities.NFeRecebida.create({
    chave_acesso: dados.chave_acesso, nsu: documento.nsu || '', origem_documento: origem,
    tipo_documento: dados.tipo_documento || 'nfe', empresa_destinataria: empresa,
    cnpj_destinatario: dados.destinatario?.cnpj || cnpjDestinatario,
    cnpj_emitente: dados.emitente?.cnpj, nome_emitente: dados.emitente?.nome, uf_emitente: dados.emitente?.uf,
    numero_nota: dados.numero_nota, serie: dados.serie, data_emissao: dados.data_emissao,
    valor_total: dados.totais?.valor_total, valor_produtos: dados.totais?.valor_produtos,
    valor_icms: dados.totais?.valor_icms, valor_icms_st: dados.totais?.valor_icms_st,
    valor_ipi: dados.totais?.valor_ipi, natureza_operacao: dados.natureza_operacao,
    xml_file_uri: file_uri, schema_documento: documento.schema,
    status_manifestacao: manifestada ? 'ciencia' : 'pendente', status_processamento: 'novo',
    erro_processamento: documento.manifestacao && !manifestada ? documento.manifestacao.xMotivo : undefined,
  });
  return { status: 'novo', id: record.id, chave: dados.chave_acesso };
}