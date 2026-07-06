import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Concilia o mês corrente usando o HISTÓRICO dos meses anteriores como gabarito.
// Pagamentos recorrentes (folha, despesas, tributos, faturas) repetem beneficiário e valor
// mês a mês — se um débito já foi conciliado antes com determinado tipo de entidade,
// o mesmo beneficiário no mês seguinte é conciliado automaticamente com o registro em aberto
// (ou pago sem vínculo) correspondente.

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b\d{6,}\b/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function termoChave(s) {
  return norm(s).split(' ').filter(t => t.length >= 3).slice(0, 4).join(' ');
}
function diffDias(a, b) {
  return Math.abs((new Date(a) - new Date(b)) / 86400000);
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

    const [lancs, vincs, folhas, despesas, tributos, faturas] = await Promise.all([
      svc.LancamentoBancario.list('-data', 5000),
      svc.VinculoExtrato.list('-created_date', 5000),
      svc.FolhaPagamento.list('-competencia', 2000),
      svc.DespesaOperacional.list('-data', 2000),
      svc.Tributo.list('-data_vencimento', 2000),
      svc.FaturaCartao.list('-data_vencimento', 500),
    ]);

    const lancById = new Map(lancs.map(l => [l.id, l]));

    // 1. Aprende os padrões: termo da descrição → tipo de entidade mais frequente no histórico
    const padroes = new Map();
    for (const v of vincs) {
      const l = lancById.get(v.lancamento_bancario_id);
      if (!l) continue;
      const t = termoChave(l.descricao);
      if (!t) continue;
      if (!padroes.has(t)) padroes.set(t, {});
      const p = padroes.get(t);
      p[v.entidade_tipo] = (p[v.entidade_tipo] || 0) + 1;
    }
    const tipoDominante = (t) => {
      const p = padroes.get(t);
      if (!p) return null;
      return Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
    };

    // 2. Débitos não conciliados com padrão conhecido
    const pendentes = lancs.filter(l =>
      l.valor < 0 &&
      l.status_conciliacao !== 'conciliado' &&
      l.status_conciliacao !== 'ignorar' &&
      !['transferencia', 'interno', 'recebimento'].includes(l.categoria)
    );

    // 3. Registros elegíveis por tipo — sem vínculo bancário (abertos OU pagos sem FK)
    const folhasLivres = folhas.filter(f => !f.lancamento_bancario_id);
    const despesasLivres = despesas.filter(d => !d.lancamento_bancario_id && !d.lancamento_cartao_id);
    const tributosLivres = tributos.filter(t => !t.lancamento_bancario_id);
    const faturasLivres = faturas.filter(f => !f.lancamento_bancario_id);
    const usados = new Set();
    const TOL = 0.50;

    const buscarAlvo = (tipo, lanc) => {
      const valor = Math.abs(lanc.valor);
      const candFiltro = (lista, getValor, getData) =>
        lista
          .filter(r => !usados.has(r.id) && Math.abs(getValor(r) - valor) <= TOL)
          .map(r => ({ r, diff: getData(r) ? diffDias(getData(r), lanc.data) : 99 }))
          .filter(c => c.diff <= 20)
          .sort((a, b) => a.diff - b.diff)[0];

      if (tipo === 'FolhaPagamento') {
        // valor pode bater com líquido, líquido+comissão ou comissão isolada
        return candFiltro(folhasLivres,
          f => f.salario_liquido || 0,
          f => f.data_pagamento || (f.competencia ? f.competencia + '-05' : null))
          || candFiltro(folhasLivres, f => f.comissao || 0, f => f.data_pagamento || (f.competencia ? f.competencia + '-05' : null));
      }
      if (tipo === 'DespesaOperacional') {
        return candFiltro(despesasLivres, d => d.valor || 0, d => d.data || d.data_vencimento);
      }
      if (tipo === 'Tributo') {
        return candFiltro(tributosLivres, t => (t.valor_pago || t.valor_original || 0), t => t.data_pagamento || t.data_vencimento);
      }
      if (tipo === 'FaturaCartao') {
        return candFiltro(faturasLivres, f => f.valor_total || 0, f => f.data_pagamento || f.data_vencimento);
      }
      return null;
    };

    // 3b. Modelo histórico por termo — o registro mais recente já conciliado com aquele termo.
    // Se o mês corrente não tem registro alvo, replica o do mês anterior (valores recorrentes).
    const registroPorTipoId = new Map();
    for (const f of folhas) registroPorTipoId.set('FolhaPagamento:' + f.id, f);
    for (const d of despesas) registroPorTipoId.set('DespesaOperacional:' + d.id, d);
    for (const t of tributos) registroPorTipoId.set('Tributo:' + t.id, t);
    const modeloPorTermo = new Map();
    for (const v of vincs) {
      const l = lancById.get(v.lancamento_bancario_id);
      if (!l) continue;
      const t = termoChave(l.descricao);
      const reg = registroPorTipoId.get(v.entidade_tipo + ':' + v.entidade_id);
      if (!t || !reg) continue;
      const atual = modeloPorTermo.get(t);
      if (!atual || (l.data || '') > (atual.dataLanc || '')) {
        modeloPorTermo.set(t, { tipo: v.entidade_tipo, reg, dataLanc: l.data, valorHist: Math.abs(l.valor || 0) });
      }
    }

    // Cria um registro novo espelhando o do mês anterior — só quando o valor se repete (±10% ou ±R$5)
    const clonarDoHistorico = async (tipo, lanc, modelo) => {
      const valor = Math.abs(lanc.valor);
      // Valores pequenos (tarifas bancárias) variam por quantidade — clona sem exigir valor igual
      const ambosPequenos = valor <= 50 && modelo.valorHist <= 50;
      const tolerancia = Math.max(modelo.valorHist * 0.10, 5);
      if (!ambosPequenos && Math.abs(valor - modelo.valorHist) > tolerancia) return null;
      const mes = (lanc.data || '').slice(0, 7);
      const m = modelo.reg;
      if (tipo === 'Tributo') {
        return await svc.Tributo.create({
          tipo: m.tipo || 'OUTRO', descricao: m.descricao || lanc.descricao, competencia: mes,
          data_vencimento: lanc.data, data_pagamento: lanc.data,
          valor_original: valor, valor_pago: valor, status: 'pago',
          empresa: m.empresa || 'NeuralTec', lancamento_bancario_id: lanc.id,
          observacoes: 'Gerado automaticamente — recorrência mensal (espelho do mês anterior)',
        });
      }
      if (tipo === 'FolhaPagamento') {
        return await svc.FolhaPagamento.create({
          funcionario_id: m.funcionario_id, funcionario_nome: m.funcionario_nome, competencia: mes,
          salario_bruto: m.salario_bruto || valor, salario_liquido: valor,
          data_pagamento: lanc.data, status: 'pago', empresa: m.empresa,
        });
      }
      if (tipo === 'DespesaOperacional') {
        return await svc.DespesaOperacional.create({
          data: lanc.data, descricao: m.descricao || lanc.descricao, fornecedor: m.fornecedor,
          categoria: m.categoria || 'outro', valor, forma_pagamento: m.forma_pagamento || 'pix',
          status: 'pago', empresa: m.empresa, recorrente: true, lancamento_bancario_id: lanc.id,
          observacoes: 'Gerado automaticamente — recorrência mensal (espelho do mês anterior)',
        });
      }
      return null; // FaturaCartao/ObraReforma não são clonadas — vêm de importação
    };

    let conciliados = 0;
    let criadosEspelho = 0;
    const detalhes = [];
    const semAlvo = {};
    const errosClone = [];

    const LOTE_MAX = 40; // evita timeout — rodar de novo processa o restante
    for (const lanc of pendentes) {
      if (conciliados >= LOTE_MAX) break;
      const t = termoChave(lanc.descricao);
      if (!t) continue;
      const tipo = tipoDominante(t);
      if (!tipo) continue;

      const alvo = buscarAlvo(tipo, lanc);
      const valor = Math.abs(lanc.valor);
      let r = alvo?.r;
      let criadoAgora = false;
      let tipoFinal = tipo;

      // Sem registro alvo? Espelha o mês anterior (mesmo beneficiário, valor recorrente).
      // Usa o modelo histórico resolvível, mesmo que o tipo dominante divirja (histórico com ruído).
      if (!r) {
        const modelo = modeloPorTermo.get(t);
        if (modelo) {
          try {
            r = await clonarDoHistorico(modelo.tipo, lanc, modelo);
            if (r) { criadoAgora = true; criadosEspelho++; tipoFinal = modelo.tipo; }
          } catch (err) {
            if (errosClone.length < 10) errosClone.push({ tipo, desc: (lanc.descricao || '').slice(0, 40), erro: err.message });
          }
        }
        if (!r) {
          semAlvo[tipo] = (semAlvo[tipo] || 0) + 1;
          continue;
        }
      }

      try {
        // Atualiza o registro alvo (registros recém-clonados já nascem pagos/vinculados)
        if (criadoAgora && tipoFinal === 'FolhaPagamento') {
          await svc.FolhaPagamento.update(r.id, { lancamento_bancario_id: lanc.id });
        } else if (!criadoAgora && tipoFinal === 'FolhaPagamento') {
          await svc.FolhaPagamento.update(r.id, { lancamento_bancario_id: lanc.id, status: 'pago', data_pagamento: lanc.data });
        } else if (!criadoAgora && tipoFinal === 'DespesaOperacional') {
          await svc.DespesaOperacional.update(r.id, { lancamento_bancario_id: lanc.id, status: 'pago' });
        } else if (!criadoAgora && tipoFinal === 'Tributo') {
          await svc.Tributo.update(r.id, { lancamento_bancario_id: lanc.id, status: 'pago', data_pagamento: lanc.data, valor_pago: valor });
        } else if (tipoFinal === 'FaturaCartao') {
          await svc.FaturaCartao.update(r.id, { lancamento_bancario_id: lanc.id, status: 'paga_total', data_pagamento: lanc.data, valor_pago: valor });
        }

        await svc.VinculoExtrato.create({
          lancamento_bancario_id: lanc.id,
          entidade_tipo: tipoFinal,
          entidade_id: r.id,
          valor_alocado: valor,
          tipo_vinculo: 'pagamento_integral',
          conciliado_por: 'auto',
          confianca: 95,
          observacao: `Padrão mensal recorrente · "${t}" já conciliado como ${tipoFinal} em meses anteriores${criadoAgora ? ' · registro espelhado do mês anterior' : ''}`,
        });
        await svc.LancamentoBancario.update(lanc.id, {
          status_conciliacao: 'conciliado',
          vinculos_count: (lanc.vinculos_count || 0) + 1,
          valor_conciliado: (lanc.valor_conciliado || 0) + valor,
        });
        usados.add(r.id);
        conciliados++;
        if (detalhes.length < 30) detalhes.push({ data: lanc.data, descricao: (lanc.descricao || '').slice(0, 50), valor: lanc.valor, tipo: tipoFinal });
      } catch (err) {
        console.error('Erro conciliar histórico:', err.message);
      }
    }

    return Response.json({
      success: true,
      conciliados,
      criados_espelho_mes_anterior: criadosEspelho,
      padroes_aprendidos: padroes.size,
      pendentes_analisados: pendentes.length,
      sem_registro_alvo: semAlvo,
      erros_clone: errosClone,
      detalhes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});