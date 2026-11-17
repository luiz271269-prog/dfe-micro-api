// Detectores da Revisão Global. Cada um lê um módulo, explica a regra e propõe procedimentos.
// "aplicar" grava só os campos listados; "registrar" só guarda a decisão; "abrir" leva ao fluxo do módulo.
const EMPRESAS = ['NeuralTec', 'Liesch'];
const TIPOS = ['estoque', 'fretes', 'impostos', 'despesas', 'folha', 'pro_labore', 'obras', 'financeiro', 'outro'];
const GENERICAS = ['outro', 'outros', '3.06'];
const vazio = v => v === undefined || v === null || v === '';
const moeda = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const opcoes = l => l.map(v => ({ valor: v, rotulo: v }));
const registrar = (id, rotulo, descricao, sugerido = false) => ({ id, tipo: 'registrar', rotulo, descricao, sugerido, efeitos: [] });
const abrir = (rota, rotulo, descricao) => ({ id: 'abrir', tipo: 'abrir', rota, rotulo, descricao, efeitos: [] });
const maisComum = l => { const c = {}; l.filter(Boolean).forEach(v => { c[v] = (c[v] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1])[0] || null; };

export const DETECTORES = [
  {
    id: 'regra_incompleta', modulo: 'Despesas Fixas', entidade: 'RegraRecorrente', rota: '/recorrentes', query: { is_ativa: true },
    condicao: r => r.is_ativa && (!EMPRESAS.includes(r.empresa) || !(Number(r.valor_esperado) > 0)),
    montar: r => {
      const semValor = !(Number(r.valor_esperado) > 0);
      return {
        situacao: 'lacuna', prioridade: 'media', certeza: semValor ? 'media' : 'alta',
        titulo: semValor ? 'Despesa fixa ativa sem valor esperado' : 'Despesa fixa ativa sem empresa',
        regra: 'Despesa fixa ativa precisa de empresa e valor esperado para ser gerada todo mês no Contas a Pagar.',
        registro: { descricao: r.nome, valor: Number(r.valor_esperado) || null },
        evidencia: [{ rotulo: 'Palavra-chave', valor: r.padrao_descricao || '—' }, { rotulo: 'Empresa', valor: r.empresa || '—' }, { rotulo: 'Valor esperado', valor: semValor ? '—' : moeda(r.valor_esperado) }, { rotulo: 'Frequência', valor: r.frequencia || '—' }],
        procedimentos: [
          ...(!EMPRESAS.includes(r.empresa) ? [{ id: 'definir_empresa', tipo: 'aplicar', rotulo: 'Definir a empresa', descricao: 'Grava a empresa no cadastro da despesa fixa.', alternativa: { campo: 'empresa', opcoes: opcoes(EMPRESAS) }, efeitos: [{ campo: 'empresa', antes: r.empresa || '—' }] }] : []),
          ...(semValor ? [{ id: 'definir_valor', tipo: 'aplicar', rotulo: 'Informar o valor esperado', descricao: 'Grava o valor mensal previsto.', alternativa: { campo: 'valor_esperado', numero: true, placeholder: 'Ex.: 250,00' }, efeitos: [{ campo: 'valor_esperado', antes: '—' }] }] : []),
          { id: 'marcar_eventual', tipo: 'aplicar', sugerido: semValor, rotulo: 'É eventual, não fixa', descricao: 'Sem valor previsto costuma indicar padrão aprendido do extrato. Deixa de gerar conta mensal.', patch: { tipo_recorrencia: 'eventual' }, efeitos: [{ campo: 'tipo_recorrencia', antes: r.tipo_recorrencia || 'fixa', depois: 'eventual' }] },
          { id: 'desativar', tipo: 'aplicar', rotulo: 'Desativar o cadastro', descricao: 'Mantém o histórico, mas para de prever e conciliar.', patch: { is_ativa: false }, efeitos: [{ campo: 'is_ativa', antes: 'ativa', depois: 'inativa' }] },
        ],
      };
    },
  },
  {
    id: 'despesa_categoria_generica', modulo: 'Despesas', entidade: 'DespesaOperacional', rota: '/despesas', query: { categoria: { $in: GENERICAS } },
    condicao: d => GENERICAS.includes(d.categoria),
    montar: (d, ctx) => {
      const hist = maisComum(ctx.despesas.filter(x => x.id !== d.id && x.fornecedor && x.fornecedor === d.fornecedor && !GENERICAS.includes(x.categoria)).map(x => x.categoria));
      const cats = [...new Set(ctx.despesas.map(x => x.categoria).filter(c => c && !GENERICAS.includes(c)))].sort();
      return {
        situacao: 'inconsistencia', prioridade: 'media', certeza: hist ? 'alta' : 'baixa',
        titulo: 'Despesa em categoria genérica', regra: 'A conta "outros" esconde a natureza do gasto na DRE; cada despesa deve ter a conta específica do plano.',
        registro: { descricao: d.descricao, valor: d.valor, data: d.data },
        evidencia: [{ rotulo: 'Fornecedor', valor: d.fornecedor || '—' }, { rotulo: 'Data', valor: d.data }, { rotulo: 'Categoria atual', valor: d.categoria }, { rotulo: 'Histórico do fornecedor', valor: hist ? `${hist[0]} (${hist[1]}×)` : 'Sem histórico' }],
        procedimentos: [
          ...(hist ? [{ id: 'usar_historico', tipo: 'aplicar', sugerido: true, rotulo: `Reclassificar como "${hist[0]}"`, descricao: 'Mesma conta usada nas outras despesas deste fornecedor.', patch: { categoria: hist[0] }, efeitos: [{ campo: 'categoria', antes: d.categoria, depois: hist[0] }] }] : []),
          ...(cats.length ? [{ id: 'escolher_categoria', tipo: 'aplicar', rotulo: 'Escolher outra conta', descricao: 'Selecione a conta correta do plano.', alternativa: { campo: 'categoria', opcoes: opcoes(cats) }, efeitos: [{ campo: 'categoria', antes: d.categoria }] }] : []),
          registrar('manter', 'Manter em "outros"', 'A despesa é de fato diversa; registra a decisão.'),
        ],
      };
    },
  },
  {
    id: 'cartao_sem_tipo', modulo: 'Cartões', entidade: 'LancamentoCartao', rota: '/cartoes', query: {},
    condicao: l => vazio(l.tipo_compra),
    montar: (l, ctx) => {
      const hist = maisComum(ctx.cartao.filter(x => x.id !== l.id && x.estabelecimento === l.estabelecimento).map(x => x.tipo_compra));
      return {
        situacao: 'lacuna', prioridade: 'media', certeza: hist ? 'alta' : 'baixa',
        titulo: 'Compra no cartão sem tipo de gasto', regra: 'Toda compra no cartão precisa do tipo de gasto para compor DRE e Contas a Pagar.',
        registro: { descricao: l.estabelecimento, valor: l.valor, data: l.data_lancamento },
        evidencia: [{ rotulo: 'Data', valor: l.data_lancamento }, { rotulo: 'Quem comprou', valor: l.origem_compra || '—' }, { rotulo: 'Histórico do estabelecimento', valor: hist ? `${hist[0]} (${hist[1]}×)` : 'Sem histórico' }],
        procedimentos: [
          ...(hist ? [{ id: 'usar_historico', tipo: 'aplicar', sugerido: true, rotulo: `Classificar como "${hist[0]}"`, descricao: 'Mesmo tipo das outras compras deste estabelecimento.', patch: { tipo_compra: hist[0] }, efeitos: [{ campo: 'tipo_compra', antes: '—', depois: hist[0] }] }] : []),
          { id: 'escolher_tipo', tipo: 'aplicar', rotulo: 'Escolher o tipo', descricao: 'Selecione o tipo de gasto.', alternativa: { campo: 'tipo_compra', opcoes: opcoes(TIPOS) }, efeitos: [{ campo: 'tipo_compra', antes: '—' }] },
        ],
      };
    },
  },
  {
    id: 'extrato_duplicidade', modulo: 'Extrato Bancário', entidade: 'LancamentoBancario', rota: '/extrato', query: { alerta_duplicidade: true },
    condicao: l => l.alerta_duplicidade === true,
    montar: l => ({
      situacao: 'inconsistencia', prioridade: 'alta', certeza: 'media',
      titulo: 'Possível lançamento duplicado no extrato', regra: 'Dois lançamentos com mesma data, valor e descrição contam o mesmo dinheiro duas vezes.',
      registro: { descricao: l.descricao, valor: l.valor, data: l.data },
      evidencia: [{ rotulo: 'Data', valor: l.data }, { rotulo: 'Conta', valor: l.conta_bancaria || '—' }, { rotulo: 'Referência', valor: l.duplicidade_ref || '—' }, { rotulo: 'Conciliação', valor: l.status_conciliacao || '—' }],
      procedimentos: [
        { id: 'nao_duplicado', tipo: 'aplicar', rotulo: 'Não é duplicidade', descricao: 'São movimentos diferentes; remove o alerta.', patch: { alerta_duplicidade: false }, efeitos: [{ campo: 'alerta_duplicidade', antes: 'sim', depois: 'não' }] },
        abrir('/extrato', 'É duplicidade: tratar no Extrato', 'A exclusão segue a deduplicação do Extrato Bancário.'),
      ],
    }),
  },
  {
    id: 'extrato_sem_conciliacao', modulo: 'Extrato Bancário', entidade: 'LancamentoBancario', rota: '/baixas', query: { status_conciliacao: 'nao_conciliado', valor: { $lt: 0 } },
    condicao: (l, ctx) => l.status_conciliacao === 'nao_conciliado' && Number(l.valor) < 0 && l.data < ctx.limite30,
    montar: l => ({
      situacao: 'lacuna', prioridade: 'baixa', certeza: 'alta',
      titulo: 'Pagamento sem documento há mais de 30 dias', regra: 'Toda saída do extrato deve estar ligada a uma conta (despesa, compra, tributo, folha ou fatura).',
      registro: { descricao: l.descricao, valor: l.valor, data: l.data },
      evidencia: [{ rotulo: 'Data', valor: l.data }, { rotulo: 'Categoria', valor: l.categoria || '—' }, { rotulo: 'Tipo de gasto', valor: l.tipo_compra || '—' }, { rotulo: 'Conta', valor: l.conta_bancaria || '—' }],
      procedimentos: [
        abrir('/baixas', 'Conciliar na Central de Baixas', 'A ligação com o documento é feita pela Central de Baixas.'),
        registrar('sem_documento', 'Não haverá documento', 'Ex.: tarifa ou transferência sem conta a pagar; registra a decisão.'),
      ],
    }),
  },
  {
    id: 'folha_sem_funcionario', modulo: 'Folha de Pagamento', entidade: 'FolhaPagamento', rota: '/funcionarios', query: {},
    condicao: f => vazio(f.funcionario_id),
    montar: f => ({
      situacao: 'inconsistencia', prioridade: 'alta', certeza: 'alta',
      titulo: 'Folha sem funcionário vinculado', regra: 'Cada folha precisa do cadastro do funcionário para edição, conferência e baixa.',
      registro: { descricao: `${f.funcionario_nome} · ${f.competencia}`, valor: f.salario_liquido },
      evidencia: [{ rotulo: 'Nome na folha', valor: f.funcionario_nome }, { rotulo: 'Competência', valor: f.competencia }, { rotulo: 'Status', valor: f.status }, { rotulo: 'Empresa', valor: f.empresa || '—' }],
      procedimentos: [abrir('/funcionarios', 'Vincular na Folha de Pagamento', 'O vínculo é feito pelo cadastro de funcionários.')],
    }),
  },
  {
    id: 'tributo_previsao', modulo: 'Tributos', entidade: 'Tributo', rota: '/tributos', query: { previsao: true },
    condicao: t => t.previsao === true,
    montar: t => ({
      situacao: 'informacao', prioridade: 'media', certeza: 'baixa',
      titulo: `${t.tipo} ${t.competencia} ainda é previsão`, regra: 'O valor foi estimado pelo faturamento e precisa da guia apurada.',
      registro: { descricao: t.descricao || t.tipo, valor: t.valor_original, data: t.data_vencimento },
      evidencia: [{ rotulo: 'Faturamento base', valor: moeda(t.previsao_base) }, { rotulo: 'Alíquota', valor: `${t.previsao_aliquota || 0}%` }, { rotulo: 'Vencimento', valor: t.data_vencimento }, { rotulo: 'Empresa', valor: t.empresa }],
      procedimentos: [abrir('/tributos', 'Confirmar valor da guia em Tributos', 'Use "Confirmar valor" na linha do tributo.'), registrar('ciente', 'Ciente, aguardar a guia', 'Registra que a previsão foi revisada.')],
    }),
  },
  {
    id: 'nota_vencida', modulo: 'Faturamento', entidade: 'NotaFiscal', rota: '/cobrancas', query: { status: 'vencido' },
    condicao: n => n.status === 'vencido',
    montar: n => ({
      situacao: 'informacao', prioridade: 'alta', certeza: 'alta',
      titulo: 'Nota vencida com valor em aberto', regra: 'Recebimento previsto não chegou até o vencimento.',
      registro: { descricao: `${n.tipo} ${n.numero} · ${n.cliente}`, valor: n.valor_aberto ?? n.valor_total, data: n.data_vencimento_proxima },
      evidencia: [{ rotulo: 'Cliente', valor: n.cliente }, { rotulo: 'Emissão', valor: n.data_emissao }, { rotulo: 'Vencimento', valor: n.data_vencimento_proxima || '—' }, { rotulo: 'Canal', valor: n.canal_cobranca || '—' }],
      procedimentos: [abrir('/cobrancas', 'Cobrar ou dar baixa em Cobranças', 'Recebimento é registrado pela conciliação com o banco.'), registrar('negociado', 'Em negociação com o cliente', 'Registra a decisão sem alterar a nota.')],
    }),
  },
];