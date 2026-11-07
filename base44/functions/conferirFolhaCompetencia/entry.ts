import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { lerCompleto, centavos } from '../../shared/conciliacaoLeitura.ts';
import { periodoPagamentoFolha } from '../../shared/folhaCalendario.ts';
import { composicaoFolha, avaliarVinculo, resumoEvidencias, mesSeguinte } from '../../shared/folhaConferencia.ts';

const lotes = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Conferência somente leitura: nenhum registro, vínculo ou estado de pagamento é alterado.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Conferência da folha restrita a administradores.' }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.competencia || '') || !['todos', 'NeuralTec', 'Liesch'].includes(b.empresa)) return Response.json({ error: 'Filtros inválidos.' }, { status: 400 });
    const db = base44.entities;
    const janela = periodoPagamentoFolha(b.competencia);
    const filtro = { competencia: b.competencia, ...(b.empresa !== 'todos' ? { empresa: b.empresa } : {}) };
    const [folhas, todasIds, vinculosTodos] = await Promise.all([
      lerCompleto(db, 'FolhaPagamento', filtro),
      lerCompleto(db, 'FolhaPagamento', {}, ['id']),
      lerCompleto(db, 'VinculoExtrato', { entidade_tipo: 'FolhaPagamento' }),
    ]);
    const existentes = new Set(todasIds.map(f => f.id));
    const idsFolha = new Set(folhas.map(f => f.id));
    const inicioRecorte = `${b.competencia}-01`, fimRecorte = `${mesSeguinte(b.competencia)}-31`;
    const daFolha = vinculosTodos.filter(v => idsFolha.has(v.entidade_id));
    const orfaosBrutos = vinculosTodos.filter(v => !existentes.has(v.entidade_id));
    const lancIds = [...new Set([...daFolha, ...orfaosBrutos].map(v => v.lancamento_bancario_id).filter(Boolean))];
    const lancs = new Map(), alocado = new Map();
    for (const lote of lotes(lancIds, 200)) {
      const [ls, aloc] = await Promise.all([
        lerCompleto(db, 'LancamentoBancario', { id: { $in: lote } }, ['id', 'data', 'descricao', 'detalhe', 'valor']),
        lerCompleto(db, 'VinculoExtrato', { lancamento_bancario_id: { $in: lote } }, ['id', 'lancamento_bancario_id', 'valor_alocado', 'tipo_vinculo']),
      ]);
      ls.forEach(l => lancs.set(l.id, l));
      aloc.forEach(v => alocado.set(v.lancamento_bancario_id, (alocado.get(v.lancamento_bancario_id) || 0) + centavos(v.valor_alocado) * (v.tipo_vinculo === 'estorno' ? -1 : 1)));
    }
    const vistos = new Map();
    for (const v of daFolha) { const k = `${v.entidade_id}:${v.lancamento_bancario_id}`; vistos.set(k, (vistos.get(k) || 0) + 1); }

    const totais = { liquido: 0, calculado: 0, pagamento_banco: 0, adiantamento: 0, informado: 0, manuais: 0, saldo_por_banco: 0 };
    const porTipo = {}, porCategoria = {}, porForma = {};
    const linhas = folhas.sort((x, y) => String(x.funcionario_nome).localeCompare(String(y.funcionario_nome))).map(f => {
      const comp = composicaoFolha(f);
      const vincs = daFolha.filter(v => v.entidade_id === f.id).map(v => avaliarVinculo(v, f, lancs.get(v.lancamento_bancario_id), alocado.get(v.lancamento_bancario_id) || 0, vistos.get(`${v.entidade_id}:${v.lancamento_bancario_id}`) > 1));
      const ev = resumoEvidencias(f, vincs);
      const alertas = [...comp.alertas];
      const totalVinculado = ev.pagamento_banco + ev.por_categoria.adiantamento;
      if (totalVinculado > comp.proventos + 1) alertas.push('vinculos_excedem_proventos');
      if (f.status === 'pago' && !vincs.length) alertas.push('pago_sem_vinculo_bancario');
      if (vincs.length && (ev.informado || ev.manuais) && ev.informado !== ev.pagamento_banco) alertas.push('evidencias_concorrentes');
      const saldo = Math.max(0, comp.armazenado - ev.pagamento_banco);
      totais.liquido += comp.armazenado; totais.calculado += comp.calculado; totais.pagamento_banco += ev.pagamento_banco;
      totais.adiantamento += ev.por_categoria.adiantamento; totais.informado += ev.informado; totais.manuais += ev.manuais; totais.saldo_por_banco += saldo;
      const tipo = f.tipo || 'mensal';
      porTipo[tipo] = porTipo[tipo] || { count: 0, liquido: 0, pagamento_banco: 0 };
      porTipo[tipo].count++; porTipo[tipo].liquido += comp.armazenado; porTipo[tipo].pagamento_banco += ev.pagamento_banco;
      const forma = f.forma_pagamento || 'nao_informada';
      porForma[forma] = porForma[forma] || { count: 0, liquido: 0 };
      porForma[forma].count++; porForma[forma].liquido += comp.armazenado;
      for (const v of vincs) { porCategoria[v.categoria] = porCategoria[v.categoria] || { count: 0, valor: 0 }; porCategoria[v.categoria].count++; porCategoria[v.categoria].valor += v.valor; }
      return {
        id: f.id, funcionario_nome: f.funcionario_nome, empresa: f.empresa, tipo, status: f.status, forma_pagamento: f.forma_pagamento || null,
        data_pagamento: f.data_pagamento || null, composicao: comp, evidencias: ev, saldo_por_banco: saldo, alertas,
        vinculos: vincs, anomalias: alertas.length + vincs.reduce((s, v) => s + v.alertas.length, 0),
      };
    });

    const orfaos = orfaosBrutos.map(v => avaliarVinculo(v, null, lancs.get(v.lancamento_bancario_id), alocado.get(v.lancamento_bancario_id) || 0, false))
      .filter(v => v.data && v.data >= inicioRecorte && v.data <= fimRecorte)
      .map(v => ({ ...v, entidade_id: orfaosBrutos.find(o => o.id === v.id)?.entidade_id, alertas: ['folha_inexistente', ...v.alertas] }));

    return Response.json({
      somente_leitura: true, competencia: b.competencia, empresa: b.empresa, janela, totais, por_tipo: porTipo, por_categoria: porCategoria, por_forma: porForma,
      folhas: linhas, orfaos, total_anomalias: linhas.reduce((s, l) => s + l.anomalias, 0) + orfaos.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}