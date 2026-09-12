// Gate 2 — carregamento paginado com status por fonte (carregada | parcial | indisponivel).
const PAGINA = 1000;
const MAX_PAGINAS = 20;

export const FONTES = [
  'LancamentoBancario', 'VinculoExtrato', 'TransferenciaInterna', 'NotaFiscal', 'IntegracaoFinanceira',
  'ItemCompra', 'Tributo', 'FolhaPagamento', 'DespesaOperacional', 'ObraReforma', 'TituloCobranca',
];

async function carregarFonte(base44, nome) {
  const registros = [];
  try {
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const lote = await base44.entities[nome].filter({}, '-created_date', PAGINA, pagina * PAGINA);
      registros.push(...lote);
      if (lote.length < PAGINA) return { registros, status: 'carregada' };
    }
    return { registros, status: 'parcial' };
  } catch (erro) {
    return { registros, status: 'indisponivel', erro: erro.message };
  }
}

export async function carregarDados(base44) {
  const resultados = await Promise.all(FONTES.map((f) => carregarFonte(base44, f)));
  const dados = {};
  const sourceStatus = {};
  FONTES.forEach((f, i) => {
    dados[f] = resultados[i].registros;
    sourceStatus[f] = { status: resultados[i].status, registros: resultados[i].registros.length, erro: resultados[i].erro };
  });
  return { dados, sourceStatus };
}