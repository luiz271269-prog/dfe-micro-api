import { normConciliacao } from './conciliacaoLeitura.ts';
import {
  beneficiarioConfere,
  ehLancamentoNaoPixNominal,
  vencimentoRastreio,
  TOLERANCIA,
} from './folhaRastreioPix.ts';

const r2 = v => Math.round(Number(v || 0) * 100) / 100;

export async function executarCorrecaoPixFolha({
  db,
  todasFolhas = [],
  folhasFiltradas,
  funcionarios,
  vinculos,
  saidas,
  lancs,
}) {
  const todasFolhasIds = new Set((todasFolhas.length ? todasFolhas : folhasFiltradas).map(f => f.id));
  const execucaoId = `correcao_pix_12m_${Date.now()}`;
  const resumo = {
    execucao_id: execucaoId,
    vinculos_removidos: 0,
    vinculos_reclassificados: 0,
    vinculos_criados: 0,
    folhas_atualizadas: 0,
    cadastros_vinculados: 0,
    detalhes: [],
  };

  const funcById = new Map(funcionarios.map(f => [f.id, f]));
  function resolverFuncionario(folha) {
    if (folha.funcionario_id && funcById.has(folha.funcionario_id)) {
      return funcById.get(folha.funcionario_id);
    }
    const n = normConciliacao(folha.funcionario_nome || '');
    return (
      funcionarios.find(
        f => f.nome && (normConciliacao(f.nome) === n || beneficiarioConfere(f.nome, folha.funcionario_nome))
      ) || null
    );
  }

  // 1. Saneamento de vínculo de funcionário (funcionario_id) e correção de escala comprovada (sem tocar em pagamentos_manuais)
  for (const folha of folhasFiltradas) {
    const func = resolverFuncionario(folha);
    const patch = {};
    let motivoPatch = [];

    if (func && !folha.funcionario_id) {
      patch.funcionario_id = func.id;
      motivoPatch.push(`Vinculado funcionario_id (${func.nome})`);
      resumo.cadastros_vinculados++;
    }

    // Correção de escala comprovada: Ricardo Rodolfo 2026-05 (líquido 3.954 com bruto 4367.33 e PIX de 3950)
    if (
      folha.competencia === '2026-05' &&
      Number(folha.salario_liquido || 0) > 0 &&
      Number(folha.salario_liquido || 0) < 10 &&
      Number(folha.salario_bruto || 0) > 3000
    ) {
      patch.salario_liquido = 3954.41;
      folha.salario_liquido = 3954.41;
      motivoPatch.push('Corrigido erro de escala no salário líquido (3.954 → 3954.41)');
    }

    // Correção de líquido contaminado por PIX de homônimo (Matheus 2026-08 com bruto 2660 e líquido 9030.74)
    if (
      folha.competencia === '2026-08' &&
      Number(folha.salario_bruto || 0) === 2660 &&
      Number(folha.salario_liquido || 0) > 8000
    ) {
      patch.salario_liquido = 2660;
      folha.salario_liquido = 2660;
      motivoPatch.push('Restaurado salário líquido para R$ 2660.00 (estava contaminado por PIX de homônimo 9030.74)');
    }

    if (Object.keys(patch).length > 0) {
      await db.AuditoriaConciliacao.create({
        execucao_id: execucaoId,
        acao: 'cache_recalculado',
        motivo: motivoPatch.join('; '),
        entidade_tipo: 'FolhaPagamento',
        entidade_id: folha.id,
        payload_original: JSON.stringify(folha),
        detalhe: `${folha.funcionario_nome} (${folha.competencia}): ${motivoPatch.join('; ')}`,
      });
      await db.FolhaPagamento.update(folha.id, patch);
      Object.assign(folha, patch);
      resumo.folhas_atualizadas++;
    }
  }

  // 2. Auditar vínculos existentes nas folhas filtradas (e vínculos órfãos de folhas já excluídas): remover inválidos e reclassificar vales no 5º–7º DU
  const idsFolhasFiltro = new Set(folhasFiltradas.map(f => f.id));
  const folhaById = new Map(folhasFiltradas.map(f => [f.id, f]));
  const vinculosAtivos = [];

  for (const v of vinculos) {
    if (!idsFolhasFiltro.has(v.entidade_id)) {
      if (!todasFolhasIds.has(v.entidade_id)) {
        const lancOrfao = lancs.get(v.lancamento_bancario_id);
        await db.AuditoriaConciliacao.create({
          execucao_id: execucaoId,
          acao: 'vinculo_removido',
          motivo: `Vínculo órfão apontando para FolhaPagamento inexistente (${v.entidade_id})`,
          entidade_tipo: 'VinculoExtrato',
          entidade_id: v.id,
          payload_original: JSON.stringify(v),
          detalhe: `Liberado PIX ${lancOrfao?.data || ''} (${lancOrfao?.descricao || v.lancamento_bancario_id})`,
        });
        await db.VinculoExtrato.delete(v.id);
        resumo.vinculos_removidos++;
        continue;
      }
      vinculosAtivos.push(v);
      continue;
    }
    const folha = folhaById.get(v.entidade_id);
    const func = resolverFuncionario(folha);
    const nomeAlvo = func?.nome || folha.funcionario_nome || '';
    const lanc = lancs.get(v.lancamento_bancario_id);
    const { janela, quinto_dia, vencimento } = vencimentoRastreio(folha);

    const naoPix = !lanc || ehLancamentoNaoPixNominal(lanc);
    const textoLanc = lanc ? `${lanc.descricao || ''} ${lanc.detalhe || ''}` : '';
    const confereBenef = lanc ? beneficiarioConfere(nomeAlvo, textoLanc) : false;

    // PIX datado nos primeiros 18 dias do próprio mês da competência que tem valor de salário integral da competência anterior
    const pagoDentroDaPropriaCompetencia =
      lanc &&
      janela &&
      (lanc.data || '').slice(0, 7) === folha.competencia &&
      Math.abs(Number(lanc.valor || 0)) >= Number(folha.salario_liquido || 0) * 0.85;

    if (naoPix || !confereBenef || pagoDentroDaPropriaCompetencia) {
      const motivoRemocao = naoPix
        ? `Lançamento não é PIX nominal (${lanc?.descricao || 'inexistente'})`
        : !confereBenef
          ? `Beneficiário do lançamento (${lanc?.descricao}) não corresponde a ${nomeAlvo}`
          : `PIX em ${lanc?.data} pertence à liquidação da competência anterior, não a ${folha.competencia}`;

      await db.AuditoriaConciliacao.create({
        execucao_id: execucaoId,
        acao: 'vinculo_removido',
        motivo: motivoRemocao,
        entidade_tipo: 'VinculoExtrato',
        entidade_id: v.id,
        payload_original: JSON.stringify(v),
        detalhe: `Desvinculado de ${nomeAlvo} (${folha.competencia}): ${lanc?.descricao || v.lancamento_bancario_id}`,
      });
      await db.VinculoExtrato.delete(v.id);
      if (lanc) {
        await db.LancamentoBancario.update(lanc.id, {
          status_conciliacao: 'nao_conciliado',
          vinculos_count: 0,
          valor_conciliado: 0,
        }).catch(() => null);
      }
      resumo.vinculos_removidos++;
      resumo.detalhes.push({
        acao: 'vinculo_removido',
        competencia: folha.competencia,
        funcionario: nomeAlvo,
        data: lanc?.data || null,
        valor: Math.abs(Number(lanc?.valor || v.valor_alocado || 0)),
        motivo: motivoRemocao,
      });
      continue;
    }

    // Verificar se está no mês seguinte (1º ao 12º dia) mas salvo como 'adiantamento'
    const noMesPagamento = janela && (lanc.data || '').slice(0, 7) === janela.mes_pagamento;
    const diaMesPag = noMesPagamento ? Number((lanc.data || '').slice(8, 10)) : 0;
    if (noMesPagamento && diaMesPag >= 1 && diaMesPag <= 12 && v.tipo_vinculo === 'adiantamento') {
      const novoTipo =
        Math.abs(Number(v.valor_alocado || 0) - Number(folha.salario_liquido || 0)) <= TOLERANCIA
          ? 'pagamento_integral'
          : 'pagamento_parcial';
      const novaObs = `Salário (${quinto_dia} a ${vencimento}) · ${nomeAlvo} · ${folha.competencia}`;

      await db.AuditoriaConciliacao.create({
        execucao_id: execucaoId,
        acao: 'vinculo_confirmado',
        motivo: `Reclassificado de adiantamento para ${novoTipo} (pago em ${lanc.data}, janela do mês seguinte)`,
        entidade_tipo: 'VinculoExtrato',
        entidade_id: v.id,
        payload_original: JSON.stringify(v),
        detalhe: `${nomeAlvo} (${folha.competencia}): R$ ${Number(v.valor_alocado || 0).toFixed(2)} em ${lanc.data}`,
      });
      await db.VinculoExtrato.update(v.id, {
        tipo_vinculo: novoTipo,
        observacao: novaObs,
      });
      v.tipo_vinculo = novoTipo;
      v.observacao = novaObs;
      resumo.vinculos_reclassificados++;
      resumo.detalhes.push({
        acao: 'vinculo_reclassificado',
        competencia: folha.competencia,
        funcionario: nomeAlvo,
        data: lanc.data,
        valor: Number(v.valor_alocado || 0),
        motivo: `Reclassificado de vale para ${novoTipo} no 5º–7º dia útil`,
      });
    }

    vinculosAtivos.push(v);
  }

  // 3. Vincular PIX nominais disponíveis na janela do mês seguinte (5º ao 7º DU e complementos do mês de pagamento)
  const lancsUsados = new Set(vinculosAtivos.map(v => v.lancamento_bancario_id).filter(Boolean));
  const vinculosPorFolha = new Map();
  for (const v of vinculosAtivos) {
    if (!vinculosPorFolha.has(v.entidade_id)) vinculosPorFolha.set(v.entidade_id, []);
    vinculosPorFolha.get(v.entidade_id).push(v);
  }

  // Ordenar folhas cronologicamente (priorizando folha mensal principal antes de duplicadas sem vínculo)
  const folhasOrdenadas = [...folhasFiltradas].sort((a, b) => {
    const cmpComp = (a.competencia || '').localeCompare(b.competencia || '');
    if (cmpComp !== 0) return cmpComp;
    const vincsA = (vinculosPorFolha.get(a.id) || []).length + (a.pagamentos_manuais || []).length;
    const vincsB = (vinculosPorFolha.get(b.id) || []).length + (b.pagamentos_manuais || []).length;
    return vincsB - vincsA;
  });

  // Controlar competências já atendidas por funcionário (para não vincular 2 folhas mensais duplicadas no mesmo mês)
  const competenciaMensalAtendida = new Set();

  for (const folha of folhasOrdenadas) {
    if ((folha.tipo || 'mensal') !== 'mensal') continue;
    const func = resolverFuncionario(folha);
    const nomeAlvo = func?.nome || folha.funcionario_nome || '';
    const chaveCompFunc = `${folha.competencia}__${normConciliacao(nomeAlvo)}`;
    const { janela, quinto_dia, vencimento } = vencimentoRastreio(folha);
    if (!janela) continue;

    const liquido = r2(Number(folha.salario_liquido || 0));
    if (liquido <= 0) continue;

    const vincsFolha = vinculosPorFolha.get(folha.id) || [];
    let pagoPix = r2(
      vincsFolha
        .filter(v => v.tipo_vinculo !== 'adiantamento')
        .reduce((s, v) => s + Number(v.valor_alocado || 0), 0)
    );

    if (pagoPix >= liquido - TOLERANCIA) {
      competenciaMensalAtendida.add(chaveCompFunc);
    } else if (!competenciaMensalAtendida.has(chaveCompFunc)) {
      // Buscar PIX nominais do funcionário no mês de pagamento (janela.mes_pagamento)
      const candidatos = saidas
        .filter(l => {
          if (lancsUsados.has(l.id)) return false;
          if (ehLancamentoNaoPixNominal(l)) return false;
          if ((l.data || '').slice(0, 7) !== janela.mes_pagamento) return false;
          const txt = `${l.descricao || ''} ${l.detalhe || ''}`;
          if (!beneficiarioConfere(nomeAlvo, txt)) return false;
          const val = Math.abs(Number(l.valor || 0));
          return val <= Math.max(liquido * 1.4, liquido + 900);
        })
        .map(l => {
          const val = r2(Math.abs(Number(l.valor || 0)));
          const diffDias = Math.abs((Date.parse(l.data) - Date.parse(janela.inicio)) / 86400000);
          const diffValor = Math.abs(val - (liquido - pagoPix));
          return { lanc: l, valor: val, diffDias, diffValor };
        })
        .sort((a, b) => a.diffDias - b.diffDias || a.diffValor - b.diffValor);

      for (const cand of candidatos) {
        const falta = r2(liquido - pagoPix);
        if (falta <= TOLERANCIA) break;
        // Aceita PIX nos primeiros 15 dias do mês seguinte (janela do 5º–7º DU ± tolerância) ou valor compatível
        if (cand.diffDias <= 10 || cand.diffValor <= TOLERANCIA || cand.valor <= falta + TOLERANCIA) {
          lancsUsados.add(cand.lanc.id);
          const valorAlocado = cand.valor;
          pagoPix = r2(pagoPix + valorAlocado);
          const tipoVinc = Math.abs(liquido - pagoPix) <= TOLERANCIA ? 'pagamento_integral' : 'pagamento_parcial';
          const novoVinc = await db.VinculoExtrato.create({
            lancamento_bancario_id: cand.lanc.id,
            entidade_tipo: 'FolhaPagamento',
            entidade_id: folha.id,
            valor_alocado: valorAlocado,
            tipo_vinculo: tipoVinc,
            conciliado_por: 'auto',
            confianca: 95,
            observacao: `Salário (${quinto_dia} a ${vencimento}) · ${nomeAlvo} · ${folha.competencia}`,
          });
          vincsFolha.push(novoVinc);
          vinculosPorFolha.set(folha.id, vincsFolha);

          await db.LancamentoBancario.update(cand.lanc.id, {
            status_conciliacao: 'conciliado',
            vinculos_count: 1,
            valor_conciliado: valorAlocado,
          }).catch(() => null);

          await db.AuditoriaConciliacao.create({
            execucao_id: execucaoId,
            acao: 'vinculo_confirmado',
            motivo: `Vinculado PIX do mês de pagamento (${cand.lanc.data}) à folha ${folha.competencia}`,
            entidade_tipo: 'VinculoExtrato',
            entidade_id: novoVinc.id,
            payload_original: JSON.stringify({ folha_id: folha.id, lancamento_id: cand.lanc.id }),
            detalhe: `${nomeAlvo} (${folha.competencia}): R$ ${valorAlocado.toFixed(2)} em ${cand.lanc.data}`,
          });

          resumo.vinculos_criados++;
          resumo.detalhes.push({
            acao: 'vinculo_criado',
            competencia: folha.competencia,
            funcionario: nomeAlvo,
            data: cand.lanc.data,
            valor: valorAlocado,
            motivo: `Vinculado PIX (${cand.lanc.data}) referente à janela ${quinto_dia} a ${vencimento}`,
          });
        }
      }
      if (pagoPix > 0) competenciaMensalAtendida.add(chaveCompFunc);
    }

    // 4. Sincronizar status e data_pagamento da FolhaPagamento (preservando pagamentos_manuais!)
    const vincsSalario = (vinculosPorFolha.get(folha.id) || []).filter(v => v.tipo_vinculo !== 'adiantamento');
    const somaPixFinal = r2(vincsSalario.reduce((s, v) => s + Number(v.valor_alocado || 0), 0));
    const somaManual = r2((folha.pagamentos_manuais || []).reduce((s, m) => s + Number(m.valor || 0), 0));
    const principalVinc = vincsSalario[0] || null;
    const principalLanc = principalVinc ? lancs.get(principalVinc.lancamento_bancario_id) : null;

    if (somaPixFinal >= liquido - TOLERANCIA && liquido > 0) {
      const novaDataPag = principalLanc?.data || folha.data_pagamento || quinto_dia;
      const novoLancId = principalVinc?.lancamento_bancario_id || folha.lancamento_bancario_id || null;
      if (
        folha.status !== 'pago' ||
        folha.data_pagamento !== novaDataPag ||
        folha.lancamento_bancario_id !== novoLancId
      ) {
        await db.FolhaPagamento.update(folha.id, {
          status: 'pago',
          data_pagamento: novaDataPag,
          lancamento_bancario_id: novoLancId,
          valor_pago: somaPixFinal,
          forma_pagamento: 'pix',
        });
        resumo.folhas_atualizadas++;
      }
    } else if (somaPixFinal === 0 && somaManual === 0 && folha.lancamento_bancario_id) {
      // Tinha um lancamento_bancario_id inválido que foi removido e não há baixa manual
      await db.FolhaPagamento.update(folha.id, {
        lancamento_bancario_id: null,
      });
      resumo.folhas_atualizadas++;
    }
  }

  return resumo;
}