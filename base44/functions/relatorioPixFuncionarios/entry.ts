import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { lerCompleto, normConciliacao } from '../../shared/conciliacaoLeitura.ts';
import { beneficiarioConfere, vencimentoRastreio, classificarPix, situacaoRastreio } from '../../shared/folhaRastreioPix.ts';

// Rastreio de PIX por funcionário × competência — SOMENTE LEITURA.
// Conclui cada competência pelo valor, data e descrição do PIX contra o vencimento (5º–7º dia útil do mês seguinte).
// Nenhuma folha, vínculo ou lançamento é alterado.
const r2 = v => Math.round(v * 100) / 100;
const lotes = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const db = base44.entities;
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

    const [folhas, funcionarios, vinculos, saidas] = await Promise.all([
      lerCompleto(db, 'FolhaPagamento', {}),
      lerCompleto(db, 'Funcionario', {}, ['id', 'nome', 'status']),
      lerCompleto(db, 'VinculoExtrato', { entidade_tipo: 'FolhaPagamento' }),
      lerCompleto(db, 'LancamentoBancario', { valor: { $lt: 0 } }, ['id', 'data', 'descricao', 'detalhe', 'valor']),
    ]);
    const lancs = new Map(saidas.map(l => [l.id, l]));
    const faltantes = [...new Set(vinculos.map(v => v.lancamento_bancario_id))].filter(id => id && !lancs.has(id));
    for (const lote of lotes(faltantes, 200)) (await lerCompleto(db, 'LancamentoBancario', { id: { $in: lote } }, ['id', 'data', 'descricao', 'detalhe', 'valor'])).forEach(l => lancs.set(l.id, l));
    const funcById = new Map(funcionarios.map(f => [f.id, f]));
    const vinculosPorFolha = new Map();
    for (const v of vinculos) { if (!vinculosPorFolha.has(v.entidade_id)) vinculosPorFolha.set(v.entidade_id, []); vinculosPorFolha.get(v.entidade_id).push(v); }

    const usadoPorLanc = new Map(); // valor já atribuído a outras competências neste rastreio
    const porFuncionario = new Map();
    for (const folha of [...folhas].sort((a, b) => (a.competencia || '').localeCompare(b.competencia || ''))) {
      const nomeCadastro = funcById.get(folha.funcionario_id)?.nome || folha.funcionario_nome;
      const { vencimento, janela } = vencimentoRastreio(folha);
      const soma = { salario: 0, comissao: 0, complemento: 0, adiantamento: 0, a_confirmar: 0, suspeito: 0, outro_beneficiario: 0 };
      const pix = [];
      for (const v of vinculosPorFolha.get(folha.id) || []) {
        const lanc = lancs.get(v.lancamento_bancario_id);
        const debito = Math.abs(Number(lanc?.valor || 0)), usado = usadoPorLanc.get(v.lancamento_bancario_id) || 0;
        const valor = r2(Math.max(0, Math.min(Number(v.valor_alocado || 0), debito - usado)));
        const alertas = [];
        if (!lanc) alertas.push('Lançamento bancário não encontrado');
        if (valor < Number(v.valor_alocado || 0) - 0.01) alertas.push(`PIX já usado em outra competência: considerado ${valor.toFixed(2)}`);
        usadoPorLanc.set(v.lancamento_bancario_id, usado + valor);
        let { tipo, motivo } = lanc ? classificarPix(folha, lanc, v, janela, valor) : { tipo: 'suspeito', motivo: 'Sem extrato' };
        const confere = lanc ? beneficiarioConfere(nomeCadastro, `${lanc.descricao} ${lanc.detalhe || ''}`) : false;
        const outro = !confere && lanc ? funcionarios.find(f => f.nome && f.id !== folha.funcionario_id && !beneficiarioConfere(nomeCadastro, f.nome) && beneficiarioConfere(f.nome, `${lanc.descricao} ${lanc.detalhe || ''}`)) : null;
        if (outro) { tipo = 'outro_beneficiario'; motivo = `PIX pago a ${outro.nome}, não a este funcionário`; alertas.push('Vínculo com beneficiário de outra pessoa'); }
        else if (!confere && tipo !== 'suspeito') { alertas.push('Nome do beneficiário não aparece na descrição do PIX'); if (tipo !== 'adiantamento') tipo = 'a_confirmar'; }
        soma[tipo] += valor;
        pix.push({ data: lanc?.data || null, valor, tipo, motivo, descricao: lanc?.descricao || '(lançamento não encontrado)', alertas });
      }
      const liquido = Number(folha.salario_liquido || 0);
      const pago = soma.salario + soma.comissao + soma.complemento;
      const situacao = situacaoRastreio({ liquido, pago, aConfirmar: soma.a_confirmar, vencimento, hoje });
      const dataSalario = pix.filter(p => p.tipo === 'salario' && p.data).map(p => p.data).sort()[0] || null;
      if (!porFuncionario.has(nomeCadastro)) porFuncionario.set(nomeCadastro, []);
      porFuncionario.get(nomeCadastro).push({
        competencia: folha.competencia, tipo: folha.tipo || 'mensal', status: folha.status, liquido,
        vencimento, janela_inicio: janela?.inicio || null, data_salario: dataSalario, situacao,
        pix_salario: r2(soma.salario), pix_comissao: r2(soma.comissao), pix_complemento: r2(soma.complemento),
        pix_adiantamentos: r2(soma.adiantamento), pix_a_confirmar: r2(soma.a_confirmar), pix_suspeito: r2(soma.suspeito + soma.outro_beneficiario),
        total_pago: r2(pago), diferenca: r2(liquido - pago),
        pix: pix.sort((a, b) => (a.data || '').localeCompare(b.data || '')),
      });
    }

    const vinculados = new Set(vinculos.map(v => v.lancamento_bancario_id));
    const naoRastreados = [];
    for (const func of funcionarios.filter(f => f.status !== 'desligado' && f.nome)) {
      for (const l of saidas) if (!vinculados.has(l.id) && beneficiarioConfere(func.nome, normConciliacao(l.descricao))) naoRastreados.push({ funcionario: func.nome, data: l.data, valor: Math.abs(l.valor), descricao: l.descricao, lancamento_id: l.id });
    }

    const relatorio = [...porFuncionario.entries()].map(([nome, comps]) => {
      comps.sort((a, b) => b.competencia.localeCompare(a.competencia));
      const s = k => r2(comps.reduce((t, c) => t + c[k], 0));
      return { funcionario: nome, total_liquido: s('liquido'), total_pago: s('total_pago'), total_adiantamentos: s('pix_adiantamentos'), total_a_confirmar: s('pix_a_confirmar'), competencias: comps };
    }).sort((a, b) => a.funcionario.localeCompare(b.funcionario));
    const todas = relatorio.flatMap(f => f.competencias);
    const saldoDe = lista => r2(lista.reduce((t, c) => t + Math.max(0, c.diferenca), 0));
    return Response.json({
      success: true, somente_leitura: true, gerado_em: new Date().toISOString(), hoje,
      totais: {
        devido: r2(todas.reduce((t, c) => t + c.liquido, 0)), pago: r2(todas.reduce((t, c) => t + c.total_pago, 0)),
        vales: r2(todas.reduce((t, c) => t + c.pix_adiantamentos, 0)), a_confirmar: r2(todas.reduce((t, c) => t + c.pix_a_confirmar, 0)),
        vencido: saldoDe(todas.filter(c => ['vencida', 'parcial'].includes(c.situacao))),
        a_vencer: saldoDe(todas.filter(c => ['a_vencer', 'parcial_a_vencer'].includes(c.situacao))),
      },
      funcionarios: relatorio,
      pix_nao_rastreados: naoRastreados.sort((a, b) => (b.data || '').localeCompare(a.data || '')),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}