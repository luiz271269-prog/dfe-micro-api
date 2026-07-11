import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// SANEAMENTO FORENSE DA CONCILIAÇÃO (Loop B)
// Regras aplicadas:
//  1. Vínculo de FolhaPagamento cujo PIX não tem identidade do funcionário → remover
//  2. Lançamento sobrealocado (Σ vínculos > |valor|) → manter por prioridade
//     (manual > confiança > mais antigo) até o teto; remover excedentes
//  3. Reabrir obrigações que perderem cobertura
//  4. Recalcular caches de TODOS os lançamentos
//  5. Limpar alertas de duplicidade falsos (sem duplicata pela chave canônica)
//  6. Normalizar sugestões com status legado ('descartada' → 'rejeitada')
// Modo: { dry_run: true } (padrão) apenas simula; { dry_run: false } aplica com trilha em AuditoriaConciliacao.

function normalizarTexto(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokensNome(n) {
  return normalizarTexto(n).split(' ').filter(t => t.length >= 3).map(t => t.replace(/^th/, 't'));
}
function temIdentidade(descricaoPix, nomeFuncionario) {
  const tb = new Set(tokensNome(descricaoPix));
  const tp = tokensNome(nomeFuncionario);
  const m = tp.filter(t => tb.has(t)).length;
  return m >= 2 || (tp.length === 1 && m === 1 && tp[0].length >= 5);
}
function chaveCanonica(l) {
  return `${l.data}|${Number(l.valor).toFixed(2)}|${(l.descricao || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // padrão: simulação
    const execId = `SANEAR-${new Date().toISOString()}`;
    const svc = base44.asServiceRole.entities;

    const [lancs, vinculos, folhas, sugestoes] = await Promise.all([
      svc.LancamentoBancario.list('-created_date', 10000),
      svc.VinculoExtrato.list('-created_date', 10000),
      svc.FolhaPagamento.list('-created_date', 2000),
      svc.SugestaoConciliacao.list('-created_date', 1000),
    ]);
    const lancMap = new Map(lancs.map(x => [x.id, x]));
    const folhaMap = new Map(folhas.map(x => [x.id, x]));

    const remover = []; // { vinculo, motivo }

    // ── 1. Folha sem identidade ──
    for (const v of vinculos) {
      if (v.entidade_tipo !== 'FolhaPagamento') continue;
      const l = lancMap.get(v.lancamento_bancario_id);
      const f = folhaMap.get(v.entidade_id);
      if (!l || !f) { remover.push({ vinculo: v, motivo: 'folha: lançamento ou folha inexistente' }); continue; }
      if (!temIdentidade(l.descricao, f.funcionario_nome)) {
        remover.push({ vinculo: v, motivo: `folha sem identidade: PIX "${(l.descricao || '').slice(0, 50)}" ≠ funcionário "${f.funcionario_nome}"` });
      }
    }
    const idsRemover = new Set(remover.map(r => r.vinculo.id));

    // ── 2. Sobrealocação — manter por prioridade até o teto ──
    const porLanc = {};
    for (const v of vinculos) {
      if (idsRemover.has(v.id)) continue;
      (porLanc[v.lancamento_bancario_id] = porLanc[v.lancamento_bancario_id] || []).push(v);
    }
    for (const [lancId, vs] of Object.entries(porLanc)) {
      const l = lancMap.get(lancId);
      if (!l) continue;
      const cap = Math.abs(l.valor || 0) + 0.01;
      const soma = vs.reduce((s, v) => s + (v.valor_alocado || 0), 0);
      if (soma <= cap) continue;
      // prioridade: manual > confiança desc > mais antigo
      const ordenados = [...vs].sort((a, b) => {
        const pa = a.conciliado_por === 'manual' ? 0 : 1;
        const pb = b.conciliado_por === 'manual' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        if ((b.confianca || 0) !== (a.confianca || 0)) return (b.confianca || 0) - (a.confianca || 0);
        return (a.created_date || '').localeCompare(b.created_date || '');
      });
      let acumulado = 0;
      for (const v of ordenados) {
        if (acumulado + (v.valor_alocado || 0) <= cap) {
          acumulado += v.valor_alocado || 0;
        } else {
          idsRemover.add(v.id);
          remover.push({ vinculo: v, motivo: `sobrealocação: Σ R$${soma.toFixed(2)} > teto R$${Math.abs(l.valor).toFixed(2)} do lançamento ${l.data} "${(l.descricao || '').slice(0, 40)}"` });
        }
      }
    }

    // ── 3. Obrigações a reabrir (perderam cobertura) ──
    const restantes = vinculos.filter(v => !idsRemover.has(v.id));
    const somaEntidade = {};
    for (const v of restantes) {
      const k = `${v.entidade_tipo}|${v.entidade_id}`;
      somaEntidade[k] = (somaEntidade[k] || 0) + (v.tipo_vinculo === 'adiantamento' ? 0 : (v.valor_alocado || 0));
    }
    const entidadesAfetadas = new Map();
    for (const r of remover) {
      entidadesAfetadas.set(`${r.vinculo.entidade_tipo}|${r.vinculo.entidade_id}`, r.vinculo);
    }
    const reabrir = [];
    for (const [k, v] of entidadesAfetadas) {
      const [tipo, id] = k.split('|');
      const coberto = somaEntidade[k] || 0;
      if (tipo === 'FolhaPagamento') {
        const f = folhaMap.get(id);
        if (f && f.status === 'pago' && coberto < (f.salario_liquido || 0) - 50) {
          reabrir.push({ tipo, id, nome: `${f.funcionario_nome} ${f.competencia}`, update: { status: 'pendente', data_pagamento: null, lancamento_bancario_id: null } });
        }
      } else if (tipo === 'DespesaOperacional') {
        const [d] = await svc.DespesaOperacional.filter({ id });
        if (d && d.status === 'pago' && coberto < (d.valor || 0) - 0.5) {
          reabrir.push({ tipo, id, nome: d.descricao, update: { status: 'pendente', lancamento_bancario_id: null } });
        }
      } else if (tipo === 'Tributo') {
        const [t] = await svc.Tributo.filter({ id });
        if (t && t.status === 'pago' && coberto < (t.valor_original || 0) - 0.5) {
          reabrir.push({ tipo, id, nome: `${t.tipo} ${t.competencia}`, update: { status: 'a_vencer', data_pagamento: null, valor_pago: coberto, lancamento_bancario_id: null } });
        }
      } else if (tipo === 'FaturaCartao') {
        const [f] = await svc.FaturaCartao.filter({ id });
        if (f && f.status === 'paga_total' && coberto < (f.valor_total || 0) - 1) {
          reabrir.push({ tipo, id, nome: `Fatura ${f.mes_referencia}`, update: { status: 'aberta', data_pagamento: null, valor_pago: coberto, lancamento_bancario_id: null } });
        }
      }
      // ObraReforma/TituloCobranca/outros: apenas registrados na auditoria
    }

    // ── 4. Caches a recalcular ──
    const somaLanc = {};
    for (const v of restantes) somaLanc[v.lancamento_bancario_id] = (somaLanc[v.lancamento_bancario_id] || 0) + (v.valor_alocado || 0);
    const contLanc = {};
    for (const v of restantes) contLanc[v.lancamento_bancario_id] = (contLanc[v.lancamento_bancario_id] || 0) + 1;
    const cachesCorrigir = [];
    for (const l of lancs) {
      const real = Math.round((somaLanc[l.id] || 0) * 100) / 100;
      const count = contLanc[l.id] || 0;
      let status = 'nao_conciliado';
      if (count > 0) status = real >= Math.abs(l.valor || 0) - 0.5 ? 'conciliado' : 'parcial';
      if (l.status_conciliacao === 'ignorar') status = 'ignorar';
      if (Math.abs((l.valor_conciliado || 0) - real) > 0.01 || (l.vinculos_count || 0) !== count || l.status_conciliacao !== status) {
        cachesCorrigir.push({ id: l.id, update: { status_conciliacao: status, vinculos_count: count, valor_conciliado: real } });
      }
    }

    // ── 5. Alertas de duplicidade falsos ──
    const cnt = new Map();
    lancs.forEach(l => cnt.set(chaveCanonica(l), (cnt.get(chaveCanonica(l)) || 0) + 1));
    const alertasFalsos = lancs.filter(l => l.alerta_duplicidade && cnt.get(chaveCanonica(l)) === 1);

    // ── 6. Sugestões com status legado ──
    const sugsLegado = sugestoes.filter(s => !['pendente', 'confirmada', 'rejeitada'].includes(s.status));

    const resumo = {
      execucao_id: execId,
      dry_run: dryRun,
      vinculos_a_remover: remover.length,
      obrigacoes_a_reabrir: reabrir.length,
      caches_a_corrigir: cachesCorrigir.length,
      alertas_falsos_a_limpar: alertasFalsos.length,
      sugestoes_a_normalizar: sugsLegado.length,
      detalhe_remocoes: remover.map(r => ({ vinculo_id: r.vinculo.id, tipo: r.vinculo.entidade_tipo, valor: r.vinculo.valor_alocado, motivo: r.motivo })),
      detalhe_reaberturas: reabrir.map(r => ({ tipo: r.tipo, nome: r.nome })),
    };

    if (dryRun) return Response.json({ success: true, ...resumo });

    // ══ APLICAÇÃO com trilha de auditoria ══
    const audit = [];
    for (const r of remover) {
      audit.push({ execucao_id: execId, acao: 'vinculo_removido', motivo: r.motivo, entidade_tipo: r.vinculo.entidade_tipo, entidade_id: r.vinculo.entidade_id, payload_original: JSON.stringify(r.vinculo), detalhe: `Vínculo ${r.vinculo.id} · R$${(r.vinculo.valor_alocado || 0).toFixed(2)} · lanc ${r.vinculo.lancamento_bancario_id}` });
    }
    for (const r of reabrir) {
      audit.push({ execucao_id: execId, acao: 'obrigacao_reaberta', motivo: 'perdeu cobertura após remoção de vínculo', entidade_tipo: r.tipo, entidade_id: r.id, payload_original: '', detalhe: r.nome });
    }
    // grava auditoria ANTES de alterar (preservação)
    for (let i = 0; i < audit.length; i += 50) {
      await svc.AuditoriaConciliacao.bulkCreate(audit.slice(i, i + 50));
    }

    for (const r of remover) await svc.VinculoExtrato.delete(r.vinculo.id);
    for (const r of reabrir) await svc[r.tipo].update(r.id, r.update);
    for (const c of cachesCorrigir) await svc.LancamentoBancario.update(c.id, c.update);
    for (const l of alertasFalsos) await svc.LancamentoBancario.update(l.id, { alerta_duplicidade: false, duplicidade_ref: '' });
    for (const s of sugsLegado) await svc.SugestaoConciliacao.update(s.id, { status: 'rejeitada' });

    return Response.json({ success: true, ...resumo, aplicado: true, auditoria_registros: audit.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});