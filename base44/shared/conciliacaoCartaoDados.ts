import { lerCompleto, dataMaisDias } from './conciliacaoLeitura.ts';
import { TIPOS_VINCULO_CARTAO } from './conciliacaoCartaoRegras.ts';
export async function carregarCandidatosCartao(db, lancamentos) {
  if (!lancamentos.length) return { documentos: [], concorrentes: [], referencias: [], trilhas: [], bancos: [] };
  const datas = lancamentos.map(l => l.data_lancamento).filter(Boolean).sort();
  if (!datas.length) throw new Error('Lançamentos sem data: revise antes de conciliar.');
  const intervalo = { $gte: dataMaisDias(datas[0], -3), $lte: dataMaisDias(datas.at(-1), 3) };
  const valores = campo => ({ $or: lancamentos.map(l => ({ [campo]: { $gte: Number(l.valor) - 0.005, $lte: Number(l.valor) + 0.005 } })) });
  const listas = await Promise.all(TIPOS_VINCULO_CARTAO.map(async tipo => {
    const data = tipo === 'ItemCompra' ? 'data_emissao' : 'data';
    const campo = tipo === 'ItemCompra' ? 'valor_total' : 'valor';
    return (await lerCompleto(db, tipo, { $and: [{ [data]: intervalo }, valores(campo)] })).map(reg => ({ tipo, reg }));
  }));
  const documentos = listas.flat();
  const concorrentes = await lerCompleto(db, 'LancamentoCartao', { $and: [{ data_lancamento: { $gte: dataMaisDias(datas[0], -6), $lte: dataMaisDias(datas.at(-1), 6) } }, valores('valor')] });
  const ids = [...new Set([...lancamentos, ...concorrentes].map(l => l.id))];
  const referencias = (await Promise.all(TIPOS_VINCULO_CARTAO.map(async tipo => (await lerCompleto(db, tipo, { lancamento_cartao_id: { $in: ids } })).map(reg => ({ tipo, reg }))))).flat();
  const [trilhas, bancos] = await Promise.all([
    lerCompleto(db, 'VinculoCartao', { lancamento_cartao_id: { $in: ids } }),
    documentos.length ? lerCompleto(db, 'VinculoExtrato', { $or: TIPOS_VINCULO_CARTAO.map(tipo => ({ entidade_tipo: tipo, entidade_id: { $in: documentos.filter(d => d.tipo === tipo).map(d => d.reg.id) } })) }) : [],
  ]);
  return { documentos, concorrentes, referencias, trilhas, bancos };
}