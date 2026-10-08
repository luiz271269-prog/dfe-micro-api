import { lerCompleto } from './conciliacaoLeitura.ts';
import { correspondeTributo, ehPagamentoTributo, empresaExtrato, competenciaExtrato, tipoTributo } from './tributoRegras.ts';
export async function conciliarTributos(base44, payload = {}) {
  const db = base44.asServiceRole.entities;
  const mes = payload.mes_referencia;
  if (mes && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido.');
  const query = { valor: { $lt: 0 }, status_conciliacao: { $nin: ['conciliado','ignorar'] }, $or: [{ categoria: 'tributo' }, { tipo_compra: 'impostos' }, { descricao: { $regex: '\\b(DAS|FGTS|INSS|GPS|DARF|ICMS|ISS)\\b|simples nacional', $options: 'i' } }] };
  if (mes) query.data = { $gte: `${mes}-01`, $lt: `${mes === '9999-12' ? mes : new Date(Date.UTC(Number(mes.slice(0,4)), Number(mes.slice(5)), 1)).toISOString().slice(0,7)}-01` };
  if (payload.empresa) query.conta_bancaria = { $regex: payload.empresa === 'Liesch' ? 'Liesch|37101' : 'NeuralTec|36092', $options: 'i' };
  const page = await db.LancamentoBancario.filter(query, { sort: '-data', limit: 50, cursor: payload.cursor_tributos || undefined });
  const pendencias = []; const baixas = []; const erros = [];
  for (const lanc of page.items.filter(ehPagamentoTributo)) {
    const vinculados = await db.VinculoExtrato.count({ lancamento_bancario_id: lanc.id });
    if (vinculados || lanc.alerta_duplicidade) continue;
    const empresa = empresaExtrato(lanc);
    const ref = competenciaExtrato(lanc);
    const tipo = tipoTributo(`${lanc.descricao || ''} ${lanc.detalhe || ''}`);
    const candidatos = empresa ? await lerCompleto(db, 'Tributo', { empresa, status: { $in: ['a_vencer','vencido','parcelado'] }, ...(tipo ? { tipo: { $in: tipo === 'INSS' ? ['INSS','GPS'] : [tipo] } } : {}), data_vencimento: { $gte: new Date(Date.parse(`${lanc.data}T12:00:00Z`) - 15*86400000).toISOString().slice(0,10), $lte: new Date(Date.parse(`${lanc.data}T12:00:00Z`) + 15*86400000).toISOString().slice(0,10) } }) : [];
    const matches = candidatos.filter(t => correspondeTributo(lanc,t));
    const concorrentes = matches.length === 1 ? await db.LancamentoBancario.count({ $and: [query, { conta_bancaria: lanc.conta_bancaria, valor: lanc.valor, data: { $gte: matches[0].data_vencimento.slice(0,7) + '-01', $lte: new Date(Date.parse(`${matches[0].data_vencimento}T12:00:00Z`) + 15*86400000).toISOString().slice(0,10) } }] }) : 0;
    if (matches.length !== 1 || concorrentes !== 1 || !tipo || payload.dry_run) {
      pendencias.push({ lancamento_bancario_id: lanc.id, empresa, tipo, competencia_referencia: ref.competencia, referencia_inferida: !ref.explicita, valor: Math.abs(lanc.valor), candidatos: matches.map(t=>({ id:t.id, competencia:t.competencia })), motivo: !empresa ? 'Identificar empresa da conta bancária' : !tipo ? 'Identificar tipo da guia' : !candidatos.length ? 'Guia não cadastrada: conferir apuração da competência; extrato não gera imposto' : matches.length !== 1 || concorrentes !== 1 ? 'Conferir guia, valor, encargos e possíveis correspondências múltiplas' : 'Correspondência elegível; análise sem baixa' });
      continue;
    }
    try {
      const { data } = await base44.functions.invoke('vincularExtrato', { acao:'criar', entidade_tipo:'Tributo', entidade_id:matches[0].id, lancamento_bancario_id:lanc.id, valor_alocado:Math.abs(lanc.valor), conciliado_por:'auto', confianca:100, observacao:`Guia mensal conferida por empresa, tipo, saldo e vencimento; competência ${matches[0].competencia} preservada`, ...(payload.internal_token ? { internal_token:payload.internal_token } : {}) });
      if (data?.error || !data?.success) throw new Error(data?.error || 'Baixa não confirmada.');
      baixas.push({ lanc_id:lanc.id, ref_id:matches[0].id, tipo:'tributo', competencia:matches[0].competencia });
    } catch (error) { erros.push({ lancamento_bancario_id:lanc.id, erro:error.message }); }
  }
  return { baixas_automaticas:baixas.length, tributos_auto_criados:0, pendencias_tributos:pendencias, detalhes:baixas, erros_tributos:erros, next_cursor_tributos:page.next_cursor, has_more_tributos:page.has_more };
}