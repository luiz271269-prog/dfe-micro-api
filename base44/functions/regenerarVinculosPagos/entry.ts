import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Regenera vínculos de registros JÁ PAGOS que ficaram sem ligação com o extrato
// (41 folhas + 85 despesas do aviso). Aplica o mesmo processo usado antes:
//   1) match exato (valor + data próxima) → vínculo automático (VinculoExtrato + FK)
//   2) match aproximado → SugestaoConciliacao com o candidato mais próximo
//   3) sem candidato → reporta o período como "extrato provavelmente não importado"

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function chavesNome(nome) {
  const partes = norm(nome).split(' ').filter(p => p.length >= 4);
  return partes;
}
function diffDias(a, b) {
  if (!a || !b) return 9999;
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internoOk = !!body?.internal_token && body.internal_token === Deno.env.get('NEXUS_HUB_TOKEN');
    if (!internoOk) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const svc = base44.asServiceRole.entities;

    const [folhas, despesas, lancamentos, vinculos, sugestoes] = await Promise.all([
      svc.FolhaPagamento.filter({ status: 'pago' }),
      svc.DespesaOperacional.filter({ status: 'pago' }),
      svc.LancamentoBancario.list('-data', 5000),
      svc.VinculoExtrato.list('-created_date', 5000),
      svc.SugestaoConciliacao.list('-created_date', 2000),
    ]);

    // Entidades já cobertas por vínculo ou sugestão existente
    const jaVinculado = new Set(vinculos.map(v => `${v.entidade_tipo}:${v.entidade_id}`));
    const jaSugerido = new Set(sugestoes.map(s => `${s.entidade_tipo}:${s.entidade_id}`));
    const lancUsados = new Set(vinculos.map(v => v.lancamento_bancario_id));

    const saidas = lancamentos.filter(l => l.valor < 0 && l.data);

    const alvos = [];
    for (const f of folhas) {
      if (f.lancamento_bancario_id || jaVinculado.has(`FolhaPagamento:${f.id}`)) continue;
      alvos.push({
        tipo: 'FolhaPagamento', reg: f,
        valor: f.salario_liquido || 0,
        dataRef: f.data_pagamento || `${f.competencia}-05`,
        nomes: chavesNome(f.funcionario_nome),
        label: `Folha ${f.competencia} · ${f.funcionario_nome}`,
        tol: 50,
      });
    }
    for (const d of despesas) {
      if (d.lancamento_bancario_id || d.lancamento_cartao_id || jaVinculado.has(`DespesaOperacional:${d.id}`)) continue;
      alvos.push({
        tipo: 'DespesaOperacional', reg: d,
        valor: d.valor || 0,
        dataRef: d.data || d.data_vencimento,
        nomes: chavesNome(d.fornecedor || d.descricao),
        label: `${d.descricao} · ${d.fornecedor || ''}`.trim(),
        tol: 1,
      });
    }

    let vinculados = 0, sugeridos = 0;
    const semExtrato = {};
    const detalhes = [];
    const LOTE_MAX = 60;

    for (const alvo of alvos) {
      if (vinculados + sugeridos >= LOTE_MAX) break;
      if (!alvo.valor || !alvo.dataRef) continue;

      // Candidatos: valor dentro da tolerância e data até 20 dias
      const candidatos = saidas
        .map(l => {
          const v = Math.abs(l.valor);
          const dd = diffDias(l.data, alvo.dataRef);
          const diffValor = Math.abs(v - alvo.valor);
          const nomeBate = alvo.nomes.length > 0 && alvo.nomes.some(n => norm(l.descricao).includes(n));
          return { l, v, dd, diffValor, nomeBate };
        })
        .filter(c => c.dd <= 20 && (c.diffValor <= alvo.tol || (c.diffValor <= alvo.valor * 0.10 && c.nomeBate)))
        .sort((a, b) => (a.diffValor + a.dd) - (b.diffValor + b.dd));

      const melhor = candidatos.find(c => !lancUsados.has(c.l.id)) || candidatos[0];

      if (!melhor) {
        const mes = (alvo.dataRef || '').slice(0, 7);
        semExtrato[mes] = (semExtrato[mes] || 0) + 1;
        continue;
      }

      // Folha só vincula automático se o NOME do funcionário aparecer no extrato (evita PIX de outra pessoa com valor parecido)
      const exato = melhor.diffValor <= alvo.tol &&
        (alvo.tipo === 'FolhaPagamento' ? melhor.nomeBate : (melhor.dd <= 5 || melhor.nomeBate));

      if (exato) {
        await svc.VinculoExtrato.create({
          lancamento_bancario_id: melhor.l.id,
          entidade_tipo: alvo.tipo,
          entidade_id: alvo.reg.id,
          valor_alocado: melhor.v,
          tipo_vinculo: 'pagamento_integral',
          conciliado_por: 'auto',
          confianca: melhor.nomeBate ? 95 : 85,
          observacao: `Regeneração de vínculo (pago sem extrato) · ${alvo.label}`,
        });
        const upd = { lancamento_bancario_id: melhor.l.id };
        if (alvo.tipo === 'FolhaPagamento') await svc.FolhaPagamento.update(alvo.reg.id, upd);
        else await svc.DespesaOperacional.update(alvo.reg.id, upd);
        await svc.LancamentoBancario.update(melhor.l.id, { status_conciliacao: 'conciliado' }).catch(() => {});
        lancUsados.add(melhor.l.id);
        vinculados++;
        detalhes.push({ acao: 'vinculado', tipo: alvo.tipo, conta: alvo.label, valor: alvo.valor, extrato: melhor.l.descricao, data: melhor.l.data });
      } else {
        if (jaSugerido.has(`${alvo.tipo}:${alvo.reg.id}`)) continue;
        await svc.SugestaoConciliacao.create({
          lancamento_bancario_id: melhor.l.id,
          entidade_tipo: alvo.tipo,
          entidade_id: alvo.reg.id,
          descricao_conta: alvo.label,
          fornecedor: alvo.reg.fornecedor || alvo.reg.funcionario_nome || '',
          valor_esperado: alvo.valor,
          valor_extrato: melhor.v,
          data_vencimento: alvo.dataRef,
          data_extrato: melhor.l.data,
          descricao_extrato: melhor.l.descricao,
          diff_dias: Math.round(melhor.dd),
          confianca: Math.max(40, 90 - Math.round(melhor.dd * 2) - Math.round(melhor.diffValor)),
          motivo: `Mais próximo encontrado: diferença R$ ${melhor.diffValor.toFixed(2)} e ${Math.round(melhor.dd)} dia(s)`,
          status: 'pendente',
        });
        jaSugerido.add(`${alvo.tipo}:${alvo.reg.id}`);
        sugeridos++;
        detalhes.push({ acao: 'sugestao', tipo: alvo.tipo, conta: alvo.label, valor: alvo.valor, extrato: melhor.l.descricao, data: melhor.l.data });
      }
    }

    return Response.json({
      success: true,
      alvos_sem_vinculo: alvos.length,
      vinculados,
      sugestoes_criadas: sugeridos,
      meses_sem_extrato: semExtrato,
      detalhes: detalhes.slice(0, 30),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});