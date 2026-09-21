import { gunzipSync } from 'node:zlib';

const pick = (xml, regex) => xml.match(regex)?.[1]?.trim() || null;
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseNFe(xml) {
  const chave = pick(xml, /<chNFe>(\d{44})<\/chNFe>/i) || pick(xml, /Id="NFe(\d{44})"/i);
  const itens = [...xml.matchAll(/<det\b[^>]*nItem="([^"]+)"[^>]*>([\s\S]*?)<\/det>/gi)].map((match) => ({
    numero: Number(match[1]),
    codigo: pick(match[2], /<cProd>([^<]+)<\/cProd>/i),
    descricao: pick(match[2], /<xProd>([^<]+)<\/xProd>/i),
    ncm: pick(match[2], /<NCM>([^<]+)<\/NCM>/i),
    cfop: pick(match[2], /<CFOP>([^<]+)<\/CFOP>/i),
    unidade: pick(match[2], /<uCom>([^<]+)<\/uCom>/i),
    quantidade: number(pick(match[2], /<qCom>([^<]+)<\/qCom>/i)),
    valor_unitario: number(pick(match[2], /<vUnCom>([^<]+)<\/vUnCom>/i)),
    valor_total: number(pick(match[2], /<vProd>([^<]+)<\/vProd>/i)),
  }));

  return {
    chave_acesso: chave,
    tipo_documento: /<resNFe[\s>]/i.test(xml) ? 'nfe_resumo' : 'nfe',
    numero_nota: pick(xml, /<nNF>([^<]+)<\/nNF>/i),
    serie: pick(xml, /<serie>([^<]+)<\/serie>/i),
    data_emissao: pick(xml, /<dhEmi>([^<]+)<\/dhEmi>/i) || pick(xml, /<dEmi>([^<]+)<\/dEmi>/i),
    natureza_operacao: pick(xml, /<natOp>([^<]+)<\/natOp>/i),
    emitente: {
      cnpj: pick(xml, /<emit>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/i) || pick(xml, /<CNPJ>(\d+)<\/CNPJ>/i),
      nome: pick(xml, /<emit>[\s\S]*?<xNome>([^<]+)<\/xNome>/i) || pick(xml, /<xNome>([^<]+)<\/xNome>/i),
      uf: pick(xml, /<emit>[\s\S]*?<UF>([^<]+)<\/UF>/i),
    },
    destinatario: {
      cnpj: pick(xml, /<dest>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/i),
      nome: pick(xml, /<dest>[\s\S]*?<xNome>([^<]+)<\/xNome>/i),
    },
    totais: {
      valor_total: number(pick(xml, /<vNF>([^<]+)<\/vNF>/i)),
      valor_produtos: number(pick(xml, /<ICMSTot>[\s\S]*?<vProd>([^<]+)<\/vProd>/i)),
      valor_icms: number(pick(xml, /<ICMSTot>[\s\S]*?<vICMS>([^<]+)<\/vICMS>/i)),
      valor_icms_st: number(pick(xml, /<ICMSTot>[\s\S]*?<vST>([^<]+)<\/vST>/i)),
      valor_ipi: number(pick(xml, /<ICMSTot>[\s\S]*?<vIPI>([^<]+)<\/vIPI>/i)),
    },
    itens,
  };
}

export function enriquecerDocZip(docZip) {
  const xml = gunzipSync(Buffer.from(docZip.data, 'base64')).toString('utf8');
  return {
    ...docZip,
    xml_base64: Buffer.from(xml, 'utf8').toString('base64'),
    dados_estruturados: parseNFe(xml),
    xml,
  };
}