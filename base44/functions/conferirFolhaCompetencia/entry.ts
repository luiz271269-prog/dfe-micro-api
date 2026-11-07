import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { lerCompleto, centavos } from '../../shared/conciliacaoLeitura.ts';
import { montarCompetencia, resumirCompetencia } from '../../shared/folhaConferenciaMes.ts';

const lotes = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const mesesDoAno = ano => Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);

// Conferência somente leitura: nenhum registro, vínculo ou estado de pagamento é alterado.
// modo "mes" (padrão): detalhe de uma competência. modo "ano": resumo dos 12 meses do ano.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Conferência da folha restrita a administradores.' }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const anual = b.modo === 'ano';
    if (!['todos', 'NeuralTec', 'Liesch'].includes(b.empresa)) return Response.json({ error: 'Filtros inválidos.' }, { status: 400 });
    if (anual ? !/^\d{4}$/.test(String(b.ano || '')) : !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.competencia || '')) return Response.json({ error: 'Período inválido.' }, { status: 400 });
    const competencias = anual ? mesesDoAno(b.ano) : [b.competencia];
    const db = base44.entities;
    const filtro = { competencia: { $in: competencias }, ...(b.empresa !== 'todos' ? { empresa: b.empresa } : {}) };
    const [folhas, todasIds, vinculosTodos] = await Promise.all([
      lerCompleto(db, 'FolhaPagamento', filtro),
      lerCompleto(db, 'FolhaPagamento', {}, ['id']),
      lerCompleto(db, 'VinculoExtrato', { entidade_tipo: 'FolhaPagamento' }),
    ]);
    const existentes = new Set(todasIds.map(f => f.id));
    const idsFolha = new Set(folhas.map(f => f.id));
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
    const vistos = new Map(), vinculosPorFolha = new Map();
    for (const v of daFolha) {
      const k = `${v.entidade_id}:${v.lancamento_bancario_id}`; vistos.set(k, (vistos.get(k) || 0) + 1);
      if (!vinculosPorFolha.has(v.entidade_id)) vinculosPorFolha.set(v.entidade_id, []);
      vinculosPorFolha.get(v.entidade_id).push(v);
    }
    const ctx = { vinculosPorFolha, orfaosBrutos, lancs, alocado, vistos };
    const meses = competencias.map(c => montarCompetencia(c, folhas.filter(f => f.competencia === c), ctx));

    if (anual) {
      const resumos = meses.map(resumirCompetencia);
      const soma = k => resumos.reduce((s, r) => s + r[k], 0);
      const natureza = { possivel_comissao: 0, comissao_informada: 0, adiantamento: 0, nao_classificado: 0 };
      for (const r of resumos) for (const k of Object.keys(natureza)) natureza[k] += r.fora_janela_natureza[k];
      return Response.json({
        somente_leitura: true, modo: 'ano', ano: b.ano, empresa: b.empresa, meses: resumos,
        totais: { folhas: soma('folhas'), vinculos: soma('vinculos'), liquido: soma('liquido'), pagamento_banco: soma('pagamento_banco'), adiantamento: soma('adiantamento'), divergencias: soma('divergencias'), fora_janela: soma('fora_janela'), fora_janela_natureza: natureza },
      });
    }
    return Response.json({ somente_leitura: true, empresa: b.empresa, ...meses[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}