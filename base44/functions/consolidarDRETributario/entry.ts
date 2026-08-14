import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Consolida impostos das NFeAnalise e calcula impacto no custo efetivo dos produtos
// Para o DRE: separa ICMS-ST e IPI (que compõem custo de aquisição não recuperável)
// de ICMS/PIS/COFINS (que podem ser recuperáveis dependendo do regime).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { mes_referencia, regime_comprador = 'simples_nacional' } = body;
    // regime_comprador: 'simples_nacional' | 'lucro_presumido_real'
    // No Simples Nacional, PIS/COFINS/ICMS NÃO são recuperáveis → compõem custo
    // No regime normal, são recuperáveis → não compõem custo (crédito)

    const todas = await base44.asServiceRole.entities.NFeAnalise.list('-data_emissao', 5000);

    // Filtro por mês se informado
    const analises = mes_referencia
      ? todas.filter(a => (a.data_emissao || '').startsWith(mes_referencia))
      : todas;

    // FALLBACK: se NFeAnalise vazia, usa ItemCompra (sem detalhe tributário, mas mostra compras)
    if (analises.length === 0) {
      const itens = await base44.asServiceRole.entities.ItemCompra.list('-data_emissao', 5000);
      const itensFiltrados = mes_referencia
        ? itens.filter(i => (i.data_emissao || '').startsWith(mes_referencia))
        : itens;

      if (itensFiltrados.length === 0) {
        return Response.json({
          mes_referencia,
          total_nfe: 0,
          mensagem: mes_referencia ? `Nenhuma NF-e nem compra no mês ${mes_referencia}` : 'Nenhuma NF-e analisada e nenhuma compra registrada',
        });
      }

      // Agrupa por nota/fornecedor para simular NFeAnalise
      const porFornecedor = {};
      const porCategoria = {};
      let comprasBrutas = 0;
      const produtosImpacto = [];

      for (const item of itensFiltrados) {
        const forn = item.fornecedor || '—';
        const cat = item.categoria_produto || 'outro';
        const valor = item.valor_total || 0;
        comprasBrutas += valor;

        if (!porFornecedor[forn]) porFornecedor[forn] = { nome: forn, count: 0, valor_produtos: 0, icms_st: 0, ipi: 0, custo_efetivo: 0 };
        porFornecedor[forn].count++;
        porFornecedor[forn].valor_produtos += valor;
        porFornecedor[forn].custo_efetivo += valor; // sem impostos

        if (!porCategoria[cat]) porCategoria[cat] = { categoria: cat, count: 0, valor: 0, custo_efetivo: 0 };
        porCategoria[cat].count++;
        porCategoria[cat].valor += valor;
        porCategoria[cat].custo_efetivo += valor;

        produtosImpacto.push({
          nfe_numero: item.numero_nota || '',
          fornecedor: forn,
          descricao: item.descricao_produto || '',
          ncm: item.codigo_produto || '',
          cfop: '',
          quantidade: item.quantidade || 1,
          valor_produto: valor,
          icms_st: 0,
          ipi: 0,
          icms_destacado: 0,
          custo_efetivo: valor,
          custo_unitario_efetivo: (item.quantidade || 1) > 0 ? valor / item.quantidade : valor,
          impacto_tributario_percentual: 0,
        });
      }

      const dre = {
        regime_comprador,
        compras_brutas: comprasBrutas,
        frete_sobre_compras: 0,
        descontos_sobre_compras: 0,
        outras_despesas_compras: 0,
        impostos_nao_recuperaveis: { icms_st: 0, ipi: 0, pis_cofins_simples: 0, total: 0 },
        creditos_tributarios: { icms: 0, pis: 0, cofins: 0, total: 0, observacao: 'Sem detalhe tributário — importe XMLs de NF-e para análise de ICMS-ST/IPI' },
        custo_mercadorias_efetivo: comprasBrutas,
        impacto_tributario_sobre_compras_percentual: 0,
        carga_tributaria_total: 0,
        carga_tributaria_percentual: 0,
      };

      return Response.json({
        mes_referencia: mes_referencia || 'todos',
        total_nfe: itensFiltrados.length,
        origem_dados: 'item_compra',
        aviso: 'DRE baseado em compras registradas. Para análise de ICMS-ST/IPI, importe XMLs de NF-e (tela Análise NFe).',
        tributos_consolidados: { valor_produtos: comprasBrutas },
        dre,
        distribuicao_uf: { interno: 0, interestadual: 0 },
        top_produtos_maior_impacto: produtosImpacto.sort((a, b) => b.valor_produto - a.valor_produto).slice(0, 20),
        top_categorias_ncm: Object.values(porCategoria).sort((a, b) => b.valor - a.valor).slice(0, 15),
        top_fornecedores_impacto: Object.values(porFornecedor).map(f => ({
          ...f, impacto_nao_recuperavel: 0, impacto_percentual: 0,
        })).sort((a, b) => b.valor_produtos - a.valor_produtos).slice(0, 15),
        total_produtos_analisados: produtosImpacto.length,
      });
    }

    // ─── Consolidação de impostos ───
    const tributos = {
      valor_produtos: 0,
      valor_frete: 0,
      valor_desconto: 0,
      valor_outras_despesas: 0,
      valor_total_nfe: 0,
      icms_total: 0,        // Destacado pelo fornecedor
      icms_st_total: 0,     // Não recuperável — compõe custo
      ipi_total: 0,         // Não recuperável p/ comércio — compõe custo
      pis_total: 0,         // Recuperável no regime normal
      cofins_total: 0,      // Recuperável no regime normal
      tributos_aproximados: 0,
    };

    // ─── Por categoria/NCM e por fornecedor ───
    const porFornecedor = {};
    const porCategoriaProduto = {};
    const porNCM = {};
    const porUF = { interno: 0, interestadual: 0 };

    // ─── Impacto por produto individual (custo efetivo) ───
    // custo_efetivo = valor_produto + ICMS_ST + IPI + (PIS+COFINS se Simples) - ICMS creditável (regime normal)
    const produtosImpacto = [];

    for (const nfe of analises) {
      tributos.valor_produtos += nfe.valor_produtos || 0;
      tributos.valor_frete += nfe.valor_frete || 0;
      tributos.valor_desconto += nfe.valor_desconto || 0;
      tributos.valor_outras_despesas += nfe.valor_outras_despesas || 0;
      tributos.valor_total_nfe += nfe.valor_total || 0;
      tributos.icms_total += nfe.icms_total || 0;
      tributos.icms_st_total += nfe.icms_st_total || 0;
      tributos.ipi_total += nfe.ipi_total || 0;
      tributos.pis_total += nfe.pis_total || 0;
      tributos.cofins_total += nfe.cofins_total || 0;
      tributos.tributos_aproximados += nfe.tributos_aproximados || 0;

      // Por fornecedor
      const forn = nfe.emitente_nome || '—';
      if (!porFornecedor[forn]) {
        porFornecedor[forn] = {
          nome: forn, cnpj: nfe.emitente_cnpj, count: 0,
          valor_produtos: 0, icms_st: 0, ipi: 0, pis: 0, cofins: 0, custo_efetivo: 0,
        };
      }
      porFornecedor[forn].count++;
      porFornecedor[forn].valor_produtos += nfe.valor_produtos || 0;
      porFornecedor[forn].icms_st += nfe.icms_st_total || 0;
      porFornecedor[forn].ipi += nfe.ipi_total || 0;
      porFornecedor[forn].pis += nfe.pis_total || 0;
      porFornecedor[forn].cofins += nfe.cofins_total || 0;

      // Por UF
      if (nfe.operacao_interestadual) porUF.interestadual += nfe.valor_total || 0;
      else porUF.interno += nfe.valor_total || 0;

      // Por produto (custo efetivo)
      for (const p of nfe.produtos || []) {
        const ncm = p.ncm || 'sem_ncm';
        if (!porNCM[ncm]) porNCM[ncm] = { ncm, count: 0, valor: 0, icms_st: 0, ipi: 0 };
        porNCM[ncm].count++;
        porNCM[ncm].valor += p.valor_total || 0;
        porNCM[ncm].icms_st += p.icms_st_valor || 0;
        porNCM[ncm].ipi += p.ipi_valor || 0;

        // Cálculo do custo efetivo por produto
        const valor = p.valor_total || 0;
        const icmsST = p.icms_st_valor || 0;  // Sempre não recuperável
        const ipi = p.ipi_valor || 0;         // Não recuperável p/ comércio
        const pis = p.pis_valor || 0;
        const cofins = p.cofins_valor || 0;
        const icms = p.icms_valor || 0;

        let custoEfetivo, detalhamento;
        if (regime_comprador === 'simples_nacional') {
          // Simples: tudo compõe custo
          custoEfetivo = valor + icmsST + ipi;
          detalhamento = {
            valor_base: valor,
            adicoes: { icms_st: icmsST, ipi },
            creditos: {},
          };
        } else {
          // Regime normal: ICMS, PIS, COFINS são créditos (não compõem custo)
          custoEfetivo = valor + icmsST + ipi - icms;
          detalhamento = {
            valor_base: valor,
            adicoes: { icms_st: icmsST, ipi },
            creditos: { icms_recuperavel: icms, pis, cofins },
          };
        }

        const impactoPercentual = valor > 0 ? ((custoEfetivo - valor) / valor) * 100 : 0;

        produtosImpacto.push({
          nfe_numero: nfe.numero_nota,
          fornecedor: forn,
          descricao: p.descricao,
          ncm: p.ncm,
          cfop: p.cfop,
          quantidade: p.quantidade,
          valor_produto: valor,
          icms_st: icmsST,
          ipi,
          icms_destacado: icms,
          custo_efetivo: custoEfetivo,
          custo_unitario_efetivo: p.quantidade > 0 ? custoEfetivo / p.quantidade : custoEfetivo,
          impacto_tributario_percentual: impactoPercentual,
          detalhamento,
        });

        // Por categoria do produto (usar primeiros 4 dígitos do NCM como proxy)
        const catKey = p.ncm ? p.ncm.slice(0, 4) : 'sem_ncm';
        if (!porCategoriaProduto[catKey]) porCategoriaProduto[catKey] = { categoria: catKey, count: 0, valor: 0, custo_efetivo: 0 };
        porCategoriaProduto[catKey].count++;
        porCategoriaProduto[catKey].valor += valor;
        porCategoriaProduto[catKey].custo_efetivo += custoEfetivo;
      }

      // Custo efetivo agregado por fornecedor
      if (regime_comprador === 'simples_nacional') {
        porFornecedor[forn].custo_efetivo += (nfe.valor_produtos || 0) + (nfe.icms_st_total || 0) + (nfe.ipi_total || 0);
      } else {
        porFornecedor[forn].custo_efetivo += (nfe.valor_produtos || 0) + (nfe.icms_st_total || 0) + (nfe.ipi_total || 0) - (nfe.icms_total || 0);
      }
    }

    // ─── Estrutura para DRE ───
    // Custo da Mercadoria Vendida (CMV) recebe:
    // - Valor dos produtos
    // - ICMS-ST (sempre não recuperável)
    // - IPI (não recuperável para comércio)
    // - PIS/COFINS (apenas no Simples)
    const custoMercadoriasLiquido = regime_comprador === 'simples_nacional'
      ? tributos.valor_produtos + tributos.icms_st_total + tributos.ipi_total
      : tributos.valor_produtos + tributos.icms_st_total + tributos.ipi_total - tributos.icms_total;

    const impactoTributarioCusto = tributos.valor_produtos > 0
      ? ((custoMercadoriasLiquido - tributos.valor_produtos) / tributos.valor_produtos) * 100
      : 0;

    const cargaTributariaTotal = tributos.icms_total + tributos.icms_st_total + tributos.ipi_total + tributos.pis_total + tributos.cofins_total;
    const cargaTributariaPercentual = tributos.valor_produtos > 0
      ? (cargaTributariaTotal / tributos.valor_produtos) * 100
      : 0;

    const dre = {
      regime_comprador,
      // Linhas do DRE relacionadas a compras
      compras_brutas: tributos.valor_produtos,
      frete_sobre_compras: tributos.valor_frete,
      descontos_sobre_compras: tributos.valor_desconto,
      outras_despesas_compras: tributos.valor_outras_despesas,

      // Composição do CMV
      impostos_nao_recuperaveis: {
        icms_st: tributos.icms_st_total,
        ipi: tributos.ipi_total,
        pis_cofins_simples: regime_comprador === 'simples_nacional' ? (tributos.pis_total + tributos.cofins_total) : 0,
        total: regime_comprador === 'simples_nacional'
          ? tributos.icms_st_total + tributos.ipi_total
          : tributos.icms_st_total + tributos.ipi_total,
      },

      creditos_tributarios: regime_comprador === 'simples_nacional' ? {
        icms: 0, pis: 0, cofins: 0, total: 0,
        observacao: 'Simples Nacional — não há créditos (tributos compõem custo)',
      } : {
        icms: tributos.icms_total,
        pis: tributos.pis_total,
        cofins: tributos.cofins_total,
        total: tributos.icms_total + tributos.pis_total + tributos.cofins_total,
        observacao: 'Regime Normal — ICMS/PIS/COFINS são recuperáveis',
      },

      // Custo efetivo líquido
      custo_mercadorias_efetivo: custoMercadoriasLiquido,
      impacto_tributario_sobre_compras_percentual: impactoTributarioCusto,
      carga_tributaria_total: cargaTributariaTotal,
      carga_tributaria_percentual: cargaTributariaPercentual,
    };

    // Top produtos por impacto tributário
    const topProdutosImpacto = [...produtosImpacto]
      .sort((a, b) => b.impacto_tributario_percentual - a.impacto_tributario_percentual)
      .slice(0, 20);

    // Top categorias NCM
    const topCategorias = Object.values(porCategoriaProduto)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 15);

    // Top fornecedores com maior impacto de ICMS-ST + IPI
    const topFornecedores = Object.values(porFornecedor)
      .map(f => ({
        ...f,
        impacto_nao_recuperavel: f.icms_st + f.ipi,
        impacto_percentual: f.valor_produtos > 0 ? ((f.icms_st + f.ipi) / f.valor_produtos) * 100 : 0,
      }))
      .sort((a, b) => b.impacto_nao_recuperavel - a.impacto_nao_recuperavel)
      .slice(0, 15);

    return Response.json({
      mes_referencia: mes_referencia || 'todos',
      total_nfe: analises.length,
      origem_dados: 'nfe_analise',
      tributos_consolidados: tributos,
      dre,
      distribuicao_uf: porUF,
      top_produtos_maior_impacto: topProdutosImpacto,
      top_categorias_ncm: topCategorias,
      top_fornecedores_impacto: topFornecedores,
      total_produtos_analisados: produtosImpacto.length,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});