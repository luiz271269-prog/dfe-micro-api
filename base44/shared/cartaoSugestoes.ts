import { consultarPedidosCentral } from './centralComprasConsulta.ts';
import { pedidosCentralCartao, avaliarPedidoCartao, textoPedidoCentral } from './cartaoCentralRegras.ts';
import { ocupacaoCartao, vinculosPedidosCentral } from './cartaoCentralVinculo.ts';
import { normalizarBaixa } from './baixasContrato.ts';
import { queryBaixas } from './baixasConsulta.ts';
import { pontuarBaixa, ordenarCandidatosBaixa } from './baixasSemelhanca.ts';
import { compraReal } from './conciliacaoCartaoRegras.ts';
import { dataMaisDias, normConciliacao } from './conciliacaoLeitura.ts';

// Somente leitura: sugere o documento de origem de uma transação do cartão, sem alterar nada.
const LOCAIS = { ItemCompra: ['valor_total', 'data_emissao', 60], DespesaOperacional: ['valor', 'data', 45], ObraReforma: ['valor', 'data', 45] };

function ordenarCentral(lista) {
  lista.sort((a, b) => a.bloqueios.length - b.bloqueios.length || b.pontos - a.pontos);
  const livres = lista.filter(c => !c.bloqueios.length);
  if (livres.length > 1 && livres[0].pontos - livres[1].pontos <= 5) livres.filter(c => c.pontos >= livres[0].pontos - 5).forEach(c => { c.ambiguo = true; });
  return lista;
}

async function documentosLocais(db, lancamento, busca, referencias) {
  const mov = normalizarBaixa('LancamentoCartao', lancamento), v = Number(lancamento.valor), d = lancamento.data_lancamento;
  const paginas = await Promise.all(Object.entries(LOCAIS).map(async ([tipo, [valor, data, janela]]) => {
    const query = busca ? queryBaixas(tipo, { busca, estado: 'pendente' }) : { $and: [{ [valor]: { $gte: v - 0.5, $lte: v + 0.5 } }, { [data]: { $gte: dataMaisDias(d, -janela), $lte: dataMaisDias(d, 15) } }] };
    return (await db[tipo].filter(query, { sort: '-created_date', limit: 10 })).items.map(r => ({ tipo, r }));
  }));
  // A Central é a fonte dos pedidos: cópias locais antigas do mesmo pedido não são sugeridas em duplicidade.
  const livres = paginas.flat().filter(({ tipo, r }) => !(tipo === 'ItemCompra' && [r.pedido_central_id, r.pedido_central_internal_id].some(x => x && referencias.has(x))));
  return ordenarCandidatosBaixa(livres.map(({ tipo, r }) => ({ ...pontuarBaixa(mov, normalizarBaixa(tipo, r), []), origem: 'local' })));
}

export async function sugestoesCartao(base44, user, b) {
  if (user.role !== 'admin') throw new Error('Sugestões de vínculo restritas a administrador.');
  if (b.tipo !== 'LancamentoCartao') throw new Error('Sugestões disponíveis somente para transações do cartão.');
  const db = base44.entities, lancamento = await db.LancamentoCartao.get(b.id);
  const busca = typeof b.busca === 'string' ? b.busca.trim().slice(0, 100) : '';
  const [ocupacao, fatura, central] = await Promise.all([ocupacaoCartao(db, lancamento), lancamento.fatura_id ? db.FaturaCartao.get(lancamento.fatura_id).catch(() => null) : null, consultarPedidosCentral()]);
  const resposta = { busca, elegivel: !!compraReal(lancamento), ocupado: ocupacao.local || ocupacao.central, central: { ok: central.ok, motivo: central.ok ? '' : central.motivo, candidatos: [], ignorados: 0 }, locais: [] };
  if (resposta.ocupado || !resposta.elegivel) return resposta;
  const referencias = new Set(central.ok ? central.data.flatMap(p => [p.id, p.numero_pedido].filter(Boolean)) : []);
  if (central.ok) {
    const { pedidos, ignorados } = pedidosCentralCartao(central.data), termo = normConciliacao(busca);
    const previa = pedidos.filter(p => termo ? normConciliacao(textoPedidoCentral(p)).includes(termo) : avaliarPedidoCartao(lancamento, p).sugerivel).slice(0, 30);
    const usados = await vinculosPedidosCentral(db, previa.map(p => p.id), lancamento.id);
    const candidatos = ordenarCentral(previa.map(p => avaliarPedidoCartao(lancamento, p, usados[p.id] || [], undefined, fatura?.mes_referencia)));
    resposta.central = { ...resposta.central, ignorados, candidatos: candidatos.slice(0, termo ? 20 : 8) };
  }
  resposta.locais = await documentosLocais(db, lancamento, busca, referencias);
  return resposta;
}