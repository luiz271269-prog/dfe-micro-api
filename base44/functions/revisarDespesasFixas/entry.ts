import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { carregarFixas, avaliarFixa, validarClassificacaoFixa } from '../../shared/despesasFixas.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Apenas administradores podem revisar despesas fixas' }, { status: 403 });
    const body = await req.json(), db = base44.entities;
    if (body.acao === 'analisar') {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.mes || '')) return Response.json({ error: 'Informe um mês válido' }, { status: 400 });
      const [ano, mes] = body.mes.split('-').map(Number), fim = `${body.mes}-${new Date(Date.UTC(ano, mes, 0)).getUTCDate()}`;
      const periodo = { $gte: `${body.mes}-01`, $lte: fim };
      const [regras, extrato, cartoes, antigas, faturas, despesas] = await Promise.all([
        carregarFixas(db, 'RegraRecorrente', { is_ativa: true }), carregarFixas(db, 'LancamentoBancario', { data: periodo }),
        carregarFixas(db, 'LancamentoCartao', { data_lancamento: periodo }), carregarFixas(db, 'SugestaoConciliacao', { entidade_tipo: 'RegraRecorrente', competencia: body.mes }),
        carregarFixas(db, 'FaturaCartao', {}), carregarFixas(db, 'DespesaOperacional', { data: periodo })
      ]);
      const propostas = [];
      for (const [canal, lancs] of [['extrato', extrato], ['cartao', cartoes]]) {
        for (const l of lancs) {
          if (canal === 'extrato' && faturas.some(f => f.lancamento_bancario_id === l.id)) continue;
          for (const r of regras) {
            const match = avaliarFixa(r, l, canal);
            if (!match) continue;
            const campo = canal === 'cartao' ? 'lancamento_cartao_id' : 'lancamento_bancario_id';
            const antiga = antigas.find(s => s.entidade_id === r.id && s[campo] === l.id);
            if (antiga && antiga.status !== 'pendente') continue;
            const ocupada = !!l.item_compra_id || !!l.alerta_duplicidade || !!l.duplicidade_ref || (canal === 'extrato' && ['conciliado', 'parcial', 'ignorar'].includes(l.status_conciliacao));
            const previa = despesas.find(d => d[campo] === l.id && d.observacoes?.includes(`Regra recorrente ${r.id} ·`));
            if (previa && canal === 'extrato' && l.status_conciliacao === 'conciliado') continue;
            propostas.push({ antiga, data: { entidade_tipo: 'RegraRecorrente', entidade_id: r.id, [campo]: l.id, canal, competencia: body.mes, descricao_conta: r.nome, fornecedor: r.fornecedor || '', valor_esperado: r.valor_esperado, valor_extrato: match.valor, data_vencimento: match.vencimento, data_extrato: match.data, descricao_extrato: canal === 'cartao' ? l.estabelecimento : l.descricao, diff_dias: match.diff_dias, confianca: 100, status: 'pendente', bloqueada: match.bloqueada || ocupada, motivo: ocupada ? 'Lançamento já tratado ou sinalizado; revise o vínculo existente' : match.motivo } });
          }
        }
      }
      for (const p of propostas) {
        const d = p.data, ciclo = d.data_vencimento;
        const concorrentes = propostas.filter(x => (x.data.entidade_id === d.entidade_id && x.data.data_vencimento === ciclo) || (x.data.canal === d.canal && (d.canal === 'cartao' ? x.data.lancamento_cartao_id === d.lancamento_cartao_id : x.data.lancamento_bancario_id === d.lancamento_bancario_id)));
        if (concorrentes.length > 1) { d.bloqueada = true; d.motivo = 'Mais de uma correspondência no ciclo; ajuste o cadastro antes de confirmar'; }
        const confirmada = antigas.some(s => s.entidade_id === d.entidade_id && s.data_vencimento === ciclo && s.status === 'confirmada');
        if (confirmada) { d.bloqueada = true; d.motivo = 'Este ciclo já tem uma ocorrência confirmada'; }
      }
      if (body.simular === true) return Response.json({ success: true, simulacao: true, candidatos: propostas.length, bloqueadas: propostas.filter(p => p.data.bloqueada).length });
      // Invalida sugestões antigas que deixaram de corresponder após editar uma regra.
      const obsoletas = antigas.filter(s => s.status === 'pendente' && !propostas.some(p => p.antiga?.id === s.id));
      const updates = [...propostas.filter(p => p.antiga).map(p => ({ id: p.antiga.id, ...p.data })), ...obsoletas.map(s => ({ id: s.id, bloqueada: true, motivo: 'Correspondência mudou; revise o cadastro e analise novamente' }))];
      const novas = propostas.filter(p => !p.antiga).map(p => p.data);
      for (let i = 0; i < updates.length; i += 100) await db.SugestaoConciliacao.bulkUpdate(updates.slice(i, i + 100));
      for (let i = 0; i < novas.length; i += 100) await db.SugestaoConciliacao.bulkCreate(novas.slice(i, i + 100));
      return Response.json({ success: true, candidatos: propostas.length, criadas: novas.length });
    }
    if (!['confirmar', 'rejeitar'].includes(body.acao) || typeof body.sugestao_id !== 'string' || body.sugestao_id.length > 100) return Response.json({ error: 'Ação inválida' }, { status: 400 });
    const [s] = await db.SugestaoConciliacao.filter({ id: body.sugestao_id, entidade_tipo: 'RegraRecorrente' });
    if (!s) return Response.json({ error: 'Sugestão não encontrada' }, { status: 404 });
    if (s.status !== 'pendente') return Response.json({ success: true, status: s.status });
    if (body.acao === 'rejeitar') {
      await db.SugestaoConciliacao.update(s.id, { status: 'rejeitada', resolvida_em: new Date().toISOString(), confirmada_por: user.id });
      return Response.json({ success: true });
    }
    if (s.bloqueada) return Response.json({ error: 'Sugestão bloqueada: revise a regra e analise novamente' }, { status: 409 });
    const [r] = await db.RegraRecorrente.filter({ id: s.entidade_id });
    const canal = s.canal, campo = canal === 'cartao' ? 'lancamento_cartao_id' : 'lancamento_bancario_id';
    const [l] = await db[canal === 'cartao' ? 'LancamentoCartao' : 'LancamentoBancario'].filter({ id: s[campo] });
    const match = r && l && avaliarFixa(r, l, canal);
    if (!match || match.bloqueada || match.valor !== s.valor_extrato || match.data !== s.data_extrato || r.valor_esperado !== s.valor_esperado) return Response.json({ error: 'Dados mudaram ou divergem. Analise novamente antes de confirmar.' }, { status: 409 });
    await validarClassificacaoFixa(db, r);
    const confirmadas = await carregarFixas(db, 'SugestaoConciliacao', { entidade_tipo: 'RegraRecorrente', status: 'confirmada', competencia: s.competencia });
    if (confirmadas.some(x => (x.entidade_id === r.id && x.data_vencimento === s.data_vencimento) || x[campo] === l.id)) return Response.json({ error: 'Ocorrência ou lançamento já confirmado' }, { status: 409 });
    // Revalida ambiguidades com os dados atuais, não só com a sugestão armazenada.
    const regrasAtuais = await carregarFixas(db, 'RegraRecorrente', { is_ativa: true });
    if (regrasAtuais.filter(x => avaliarFixa(x, l, canal)).length !== 1) return Response.json({ error: 'Mais de uma regra corresponde ao lançamento' }, { status: 409 });
    const periodo = { $gte: `${s.competencia}-01`, $lte: `${s.competencia}-31` };
    const atuais = await carregarFixas(db, canal === 'cartao' ? 'LancamentoCartao' : 'LancamentoBancario', { [canal === 'cartao' ? 'data_lancamento' : 'data']: periodo });
    if (atuais.filter(x => { const m = avaliarFixa(r, x, canal); return m && m.vencimento === match.vencimento; }).length !== 1) return Response.json({ error: 'Mais de um lançamento corresponde ao ciclo; revise o cadastro' }, { status: 409 });
    if (canal === 'cartao') {
      if (l.item_compra_id) return Response.json({ error: 'Compra já vinculada a outro módulo' }, { status: 409 });
      const conflitos = await Promise.all(['ItemCompra', 'ObraReforma'].map(t => db[t].filter({ lancamento_cartao_id: l.id }, 'id', 1)));
      if (conflitos.some(rows => rows.length)) return Response.json({ error: 'Compra já registrada em outro módulo; revise o vínculo existente para não duplicar despesas' }, { status: 409 });
      const existentes = await db.DespesaOperacional.filter({ lancamento_cartao_id: l.id });
      if (existentes.length > 1 || existentes.some(d => d.lancamento_bancario_id || Math.abs(d.valor - match.valor) > 0.01 || (d.empresa && d.empresa !== r.empresa) || d.categoria !== r.categoria || d.tipo_compra !== r.tipo_compra || d.origem_compra !== r.origem_compra)) return Response.json({ error: 'Despesa existente com classificação ou vínculo divergente. Revise antes de associar à fixa.' }, { status: 409 });
      const [fatura] = await db.FaturaCartao.filter({ id: l.fatura_id });
      if (!fatura) return Response.json({ error: 'Fatura não encontrada; regularize o cartão antes de confirmar' }, { status: 409 });
      await db.LancamentoCartao.update(l.id, { categoria: r.categoria, origem_compra: r.origem_compra, tipo_compra: r.tipo_compra, empresa_beneficiada: r.empresa, natureza: ['pessoal', 'pro_labore'].includes(r.origem_compra) ? 'pessoal' : 'empresarial' });
      if (existentes[0] && !existentes[0].recorrente) await db.DespesaOperacional.update(existentes[0].id, { recorrente: true });
      // O vínculo persistente é esta sugestão confirmada. Não cria outra despesa nem baixa a fatura.
    } else {
      const diretas = await db.DespesaOperacional.filter({ lancamento_bancario_id: l.id });
      const jaFeita = diretas.find(d => d.observacoes?.includes(`Regra recorrente ${r.id} ·`));
      const vinculos = await db.VinculoExtrato.filter({ lancamento_bancario_id: l.id });
      if (!(jaFeita && vinculos.some(v => v.entidade_tipo === 'DespesaOperacional' && v.entidade_id === jaFeita.id && Math.abs(v.valor_alocado - match.valor) < 0.01))) {
        const res = await base44.functions.invoke('conciliarRegraRecorrente', { regra_id: r.id, lancamento_id: l.id });
        if (!res.data?.success) return Response.json({ error: res.data?.error || 'Não foi possível conciliar' }, { status: 409 });
      }
    }
    await db.SugestaoConciliacao.update(s.id, { status: 'confirmada', resolvida_em: new Date().toISOString(), confirmada_por: user.id });
    return Response.json({ success: true, canal });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}