import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { lerCompleto, normConciliacao } from '../../shared/conciliacaoLeitura.ts';
import { periodoPagamentoFolha } from '../../shared/folhaCalendario.ts';
import {
  beneficiarioConfere,
  ehLancamentoNaoPixNominal,
  vencimentoRastreio,
  ultimasCompetencias,
  classificarPix,
  situacaoRastreio,
  TOLERANCIA,
} from '../../shared/folhaRastreioPix.ts';
import { executarCorrecaoPixFolha } from '../../shared/folhaExecutarCorrecaoPix.ts';

// Auditoria e Rastreio de PIX por funcionário × competência (últimos 12 meses ou histórico) — SOMENTE LEITURA.
// Verifica se cada folha mensal teve seu PIX vinculado conforme a regra do 5º ao 7º dia útil do mês subsequente.
// Nenhuma folha, vínculo ou lançamento bancário é alterado.
const r2 = v => Math.round(Number(v || 0) * 100) / 100;
const lotes = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mesesFiltro = body?.meses === 0 ? 0 : Number(body?.meses || 12);

    const db = base44.entities;
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const competencias12m = ultimasCompetencias(hoje, 12);
    const setCompetenciasAtivas = mesesFiltro > 0 ? new Set(ultimasCompetencias(hoje, mesesFiltro)) : null;

    let [folhasRaw, funcionarios, vinculos, saidas] = await Promise.all([
      lerCompleto(db, 'FolhaPagamento', {}),
      lerCompleto(db, 'Funcionario', {}, ['id', 'nome', 'cpf', 'status']),
      lerCompleto(db, 'VinculoExtrato', { entidade_tipo: 'FolhaPagamento' }),
      lerCompleto(db, 'LancamentoBancario', { valor: { $lt: 0 } }, ['id', 'data', 'descricao', 'detalhe', 'valor']),
    ]);

    const lancs = new Map(saidas.map(l => [l.id, l]));
    const faltantes = [...new Set(vinculos.map(v => v.lancamento_bancario_id))].filter(id => id && !lancs.has(id));
    for (const lote of lotes(faltantes, 200)) {
      (await lerCompleto(db, 'LancamentoBancario', { id: { $in: lote } }, ['id', 'data', 'descricao', 'detalhe', 'valor'])).forEach(l => lancs.set(l.id, l));
    }

    let execucaoCorrecao = null;
    if (body?.acao === 'aplicar_correcoes') {
      const folhasAlvo = folhasRaw.filter(f => !setCompetenciasAtivas || setCompetenciasAtivas.has(f.competencia));
      execucaoCorrecao = await executarCorrecaoPixFolha({
        db: base44.asServiceRole.entities,
        folhasFiltradas: folhasAlvo,
        funcionarios,
        vinculos,
        saidas,
        lancs,
      });
      // Recarregar folhas e vínculos após aplicar as correções auditadas
      [folhasRaw, vinculos] = await Promise.all([
        lerCompleto(db, 'FolhaPagamento', {}),
        lerCompleto(db, 'VinculoExtrato', { entidade_tipo: 'FolhaPagamento' }),
      ]);
    }

    // Cobertura de extrato por mês YYYY-MM
    const datasPorMesExtrato = new Map();
    for (const s of saidas) {
      const m = (s.data || '').slice(0, 7);
      if (!m) continue;
      if (!datasPorMesExtrato.has(m)) datasPorMesExtrato.set(m, { count: 0, min: s.data, max: s.data });
      const info = datasPorMesExtrato.get(m);
      info.count++;
      if (s.data < info.min) info.min = s.data;
      if (s.data > info.max) info.max = s.data;
    }

    function avaliarCoberturaMesPagamento(janela) {
      if (!janela?.mes_pagamento) return { status: 'completa', ate: null };
      const info = datasPorMesExtrato.get(janela.mes_pagamento);
      if (!info || info.count === 0) return { status: 'ausente', ate: null };
      if (info.max < janela.inicio) return { status: 'parcial', ate: info.max };
      return { status: 'completa', ate: info.max };
    }

    const funcById = new Map(funcionarios.map(f => [f.id, f]));
    const vinculosPorFolha = new Map();
    for (const v of vinculos) {
      if (!vinculosPorFolha.has(v.entidade_id)) vinculosPorFolha.set(v.entidade_id, []);
      vinculosPorFolha.get(v.entidade_id).push(v);
    }

    // Resolver nome canônico do funcionário para agrupar corretamente
    function nomeCanonico(folha) {
      if (folha.funcionario_id && funcById.has(folha.funcionario_id)) return funcById.get(folha.funcionario_id).nome;
      const n = normConciliacao(folha.funcionario_nome || '');
      const match = funcionarios.find(f => f.nome && (normConciliacao(f.nome) === n || beneficiarioConfere(folha.funcionario_nome, f.nome)));
      return match?.nome || folha.funcionario_nome;
    }

    // Mapear PIX de extrato já vinculados por funcionário (para detectar baixa manual duplicada em outro mês)
    const pixExtratoPorFunc = new Map();
    for (const f of folhasRaw) {
      const k = normConciliacao(nomeCanonico(f));
      for (const v of vinculosPorFolha.get(f.id) || []) {
        const l = lancs.get(v.lancamento_bancario_id);
        if (!l) continue;
        if (!pixExtratoPorFunc.has(k)) pixExtratoPorFunc.set(k, []);
        pixExtratoPorFunc.get(k).push({
          lancamento_id: l.id,
          data: l.data,
          valor: Math.abs(Number(l.valor)),
          competencia: f.competencia,
          folha_id: f.id,
          descricao: l.descricao,
        });
      }
    }

    // Identificar lançamentos bancários não vinculados a nenhuma folha e que conferem com funcionários
    const idsLancVinculados = new Set(vinculos.map(v => v.lancamento_bancario_id).filter(Boolean));
    const candidatosDisponiveis = [];
    for (const l of saidas) {
      if (idsLancVinculados.has(l.id)) continue;
      if (ehLancamentoNaoPixNominal(l)) continue;
      const textoLanc = `${l.descricao || ''} ${l.detalhe || ''}`;
      for (const func of funcionarios) {
        if (!func.nome) continue;
        if (beneficiarioConfere(func.nome, textoLanc)) {
          candidatosDisponiveis.push({
            lancamento_id: l.id,
            funcionario: func.nome,
            chave_func: normConciliacao(func.nome),
            data: l.data,
            mes: (l.data || '').slice(0, 7),
            valor: r2(Math.abs(Number(l.valor || 0))),
            descricao: l.descricao,
          });
          break;
        }
      }
    }

    const candidatosUsados = new Set(); // Garante matching conservador 1-para-1 (nunca atribui 1 PIX a >1 folha)
    const usadoPorLanc = new Map();
    const porFuncionario = new Map();
    const planoCorrecao = [];

    const folhasFiltradas = folhasRaw
      .filter(f => !setCompetenciasAtivas || setCompetenciasAtivas.has(f.competencia))
      .sort((a, b) => (a.competencia || '').localeCompare(b.competencia || ''));

    for (const folha of folhasFiltradas) {
      const nomeCadastro = nomeCanonico(folha);
      const chaveFunc = normConciliacao(nomeCadastro);
      const { quinto_dia, vencimento, janela } = vencimentoRastreio(folha);
      const cobertura = avaliarCoberturaMesPagamento(janela);
      const liquido = r2(Number(folha.salario_liquido || 0));

      const soma = {
        salario: 0,
        comissao: 0,
        complemento: 0,
        adiantamento: 0,
        adiantamento_em_dia_salario: 0,
        a_confirmar: 0,
        suspeito: 0,
        outro_beneficiario: 0,
        nao_pix: 0,
        baixa_manual: 0,
      };
      const pix = [];
      let temDuplicidadeManual = false;
      let temRevisaoVinculo = false;

      // 1. Avaliar baixas manuais (sempre mantidas como evidência independente, nunca removidas)
      for (const pm of folha.pagamentos_manuais || []) {
        const valor = r2(Number(pm.valor || 0));
        if (valor <= 0) continue;
        const alertas = [];
        const inicioMesPag = janela ? `${janela.mes_pagamento}-01` : null;
        const fimMesPag = janela ? `${janela.mes_pagamento}-31` : null;
        const foraMesPag = janela && (pm.data < inicioMesPag || pm.data > fimMesPag);

        const dupExtrato = (pixExtratoPorFunc.get(chaveFunc) || []).find(
          p => p.data === pm.data && Math.abs(p.valor - valor) <= 5
        );

        if (dupExtrato) {
          temDuplicidadeManual = true;
          alertas.push(
            `Baixa manual em ${pm.data} coincide com PIX já vinculado pelo extrato na competência ${dupExtrato.competencia} (${dupExtrato.descricao})`
          );
          planoCorrecao.push({
            competencia: folha.competencia,
            funcionario: nomeCadastro,
            folha_id: folha.id,
            acao: 'sinalizar_baixa_manual_duplicada',
            grau_evidencia: 'alta',
            quinto_dia_util: quinto_dia,
            data_evento: pm.data,
            valor_folha: liquido,
            valor_evento: valor,
            vinculo_atual: `Baixa manual em ${folha.competencia} (${pm.data})`,
            evidencia_descricao: `PIX de ${pm.data} já conciliado na competência ${dupExtrato.competencia}`,
            motivo: `Pagamento em ${pm.data} (5º dia útil de ${pm.data.slice(0, 7)}) pertence à folha ${dupExtrato.competencia} e já está conciliado via extrato. Baixa manual preservada como evidência independente; revisar para não contar em dobro.`,
          });
        } else if (foraMesPag) {
          temDuplicidadeManual = true;
          const janelaMesBaixa = periodoPagamentoFolha(
            new Date(Date.UTC(Number(pm.data.slice(0, 4)), Number(pm.data.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7)
          );
          const compProvavel = janelaMesBaixa?.competencia || 'mês anterior';
          alertas.push(
            `Data da baixa manual (${pm.data}) está fora do mês de pagamento esperado (${janela.mes_pagamento}); pela regra do 5º dia útil, pagamentos no início de ${pm.data.slice(0, 7)} liquidam ${compProvavel}`
          );
          planoCorrecao.push({
            competencia: folha.competencia,
            funcionario: nomeCadastro,
            folha_id: folha.id,
            acao: 'sinalizar_baixa_manual_duplicada',
            grau_evidencia: 'media',
            quinto_dia_util: quinto_dia,
            data_evento: pm.data,
            valor_folha: liquido,
            valor_evento: valor,
            vinculo_atual: `Baixa manual em ${folha.competencia} (${pm.data})`,
            evidencia_descricao: `Baixa manual datada em ${pm.data} (fora de ${janela.mes_pagamento})`,
            motivo: `Folha de ${folha.competencia} vence no 5º dia útil de ${janela.mes_pagamento} (${quinto_dia}), mas a baixa manual foi datada em ${pm.data}. Baixa preservada sem alteração automática.`,
          });
        }

        soma.baixa_manual += valor;
        pix.push({
          data: pm.data,
          valor,
          tipo: 'baixa_manual',
          motivo: `Evidência independente: baixa manual registrada na folha (${pm.forma || 'pix'}), sem vínculo de extrato`,
          descricao: `Baixa manual (${pm.forma || 'pix'})`,
          alertas,
        });
      }

      // 2. Avaliar vínculos de extrato existentes (VinculoExtrato)
      for (const v of vinculosPorFolha.get(folha.id) || []) {
        const lanc = lancs.get(v.lancamento_bancario_id);
        const debito = Math.abs(Number(lanc?.valor || 0));
        const usado = usadoPorLanc.get(v.lancamento_bancario_id) || 0;
        const valor = r2(Math.max(0, Math.min(Number(v.valor_alocado || 0), debito - usado)));
        const alertas = [];
        if (!lanc) alertas.push('Lançamento bancário não encontrado');
        if (valor < Number(v.valor_alocado || 0) - 0.01) {
          alertas.push(`PIX compartilhado/alocado em outra competência: considerado R$ ${valor.toFixed(2)}`);
        }
        usadoPorLanc.set(v.lancamento_bancario_id, usado + valor);

        let { tipo, motivo, gravadoComoValeNoQuintoDia } = lanc
          ? classificarPix(folha, lanc, v, janela, valor)
          : { tipo: 'suspeito', motivo: 'Sem lançamento bancário', gravadoComoValeNoQuintoDia: false };

        if (lanc && tipo !== 'nao_pix') {
          const textoLanc = `${lanc.descricao || ''} ${lanc.detalhe || ''}`;
          const confere = beneficiarioConfere(nomeCadastro, textoLanc);
          const outro = !confere
            ? funcionarios.find(
                f =>
                  f.nome &&
                  normConciliacao(f.nome) !== chaveFunc &&
                  !beneficiarioConfere(nomeCadastro, f.nome) &&
                  beneficiarioConfere(f.nome, textoLanc)
              )
            : null;

          if (outro) {
            tipo = 'outro_beneficiario';
            motivo = `PIX nominal a ${outro.nome}, vinculado por engano à folha de ${nomeCadastro}`;
            alertas.push(`Beneficiário divergente: PIX pertence a ${outro.nome}`);
            temRevisaoVinculo = true;
            planoCorrecao.push({
              competencia: folha.competencia,
              funcionario: nomeCadastro,
              folha_id: folha.id,
              vinculo_id: v.id,
              lancamento_id: lanc.id,
              acao: 'desvincular_outro_beneficiario',
              grau_evidencia: 'alta',
              quinto_dia_util: quinto_dia,
              data_evento: lanc.data,
              valor_folha: liquido,
              valor_evento: valor,
              vinculo_atual: `Vinculado a ${nomeCadastro} (${folha.competencia})`,
              evidencia_descricao: lanc.descricao,
              motivo: `O lançamento bancário identifica explicitamente ${outro.nome}. Deve ser revisado antes de qualquer realocação.`,
            });
          } else if (!confere && tipo !== 'suspeito') {
            alertas.push('Nome do funcionário não consta na descrição do lançamento');
            if (tipo !== 'adiantamento') tipo = 'a_confirmar';
            temRevisaoVinculo = true;
          }
        }

        if (tipo === 'nao_pix' && lanc) {
          temRevisaoVinculo = true;
          alertas.push('Vínculo aponta para lançamento que não é PIX nominal');
          planoCorrecao.push({
            competencia: folha.competencia,
            funcionario: nomeCadastro,
            folha_id: folha.id,
            vinculo_id: v.id,
            lancamento_id: lanc.id,
            acao: 'desvincular_outro_beneficiario',
            grau_evidencia: 'alta',
            quinto_dia_util: quinto_dia,
            data_evento: lanc.data,
            valor_folha: liquido,
            valor_evento: valor,
            vinculo_atual: `Vinculado como ${v.tipo_vinculo || 'pagamento'}`,
            evidencia_descricao: lanc.descricao,
            motivo: `Lançamento "${lanc.descricao}" não é transferência PIX nominal ao colaborador.`,
          });
        } else if (gravadoComoValeNoQuintoDia && lanc) {
          temRevisaoVinculo = true;
          alertas.push(`Vínculo salvo como "adiantamento", mas pago na janela de salário do mês seguinte (${lanc.data})`);
          planoCorrecao.push({
            competencia: folha.competencia,
            funcionario: nomeCadastro,
            folha_id: folha.id,
            vinculo_id: v.id,
            lancamento_id: lanc.id,
            acao: 'reclassificar_vale_para_salario',
            grau_evidencia: 'alta',
            quinto_dia_util: quinto_dia,
            data_evento: lanc.data,
            valor_folha: liquido,
            valor_evento: valor,
            vinculo_atual: `tipo_vinculo = "${v.tipo_vinculo}" (${v.observacao || 'sem obs'})`,
            evidencia_descricao: lanc.descricao,
            motivo: `Pago em ${lanc.data} (janela do 5º ao 7º dia útil de ${janela?.mes_pagamento}: ${quinto_dia} a ${vencimento}). Como está marcado como adiantamento, a tela de folha ignora este valor no cálculo de salário quitado.`,
          });
        } else if (tipo === 'suspeito' && lanc) {
          temRevisaoVinculo = true;
          alertas.push('Valor muito acima do líquido da folha');
          planoCorrecao.push({
            competencia: folha.competencia,
            funcionario: nomeCadastro,
            folha_id: folha.id,
            vinculo_id: v.id,
            lancamento_id: lanc.id,
            acao: 'desvincular_outro_beneficiario',
            grau_evidencia: 'alta',
            quinto_dia_util: quinto_dia,
            data_evento: lanc.data,
            valor_folha: liquido,
            valor_evento: valor,
            vinculo_atual: `Vinculado em ${folha.competencia}`,
            evidencia_descricao: lanc.descricao,
            motivo: motivo,
          });
        } else if (tipo === 'a_confirmar' && lanc && janela && lanc.data.slice(0, 7) === folha.competencia) {
          temRevisaoVinculo = true;
          const compAnt = new Date(Date.UTC(Number(folha.competencia.slice(0, 4)), Number(folha.competencia.slice(5, 7)) - 2, 1))
            .toISOString()
            .slice(0, 7);
          planoCorrecao.push({
            competencia: folha.competencia,
            funcionario: nomeCadastro,
            folha_id: folha.id,
            vinculo_id: v.id,
            lancamento_id: lanc.id,
            acao: 'realocar_competencia',
            grau_evidencia: 'media',
            quinto_dia_util: quinto_dia,
            data_evento: lanc.data,
            valor_folha: liquido,
            valor_evento: valor,
            vinculo_atual: `Vinculado em ${folha.competencia}`,
            evidencia_descricao: lanc.descricao,
            motivo: `PIX realizado em ${lanc.data} (dentro do próprio mês ${folha.competencia}). Verificar se liquida a competência anterior (${compAnt}) ou se é adiantamento/vale.`,
          });
        }

        soma[tipo] = r2((soma[tipo] || 0) + valor);
        pix.push({
          data: lanc?.data || null,
          valor,
          tipo,
          tipo_vinculo_original: v.tipo_vinculo || 'pagamento_integral',
          motivo,
          descricao: lanc?.descricao || '(lançamento não encontrado)',
          alertas,
        });
      }

      // 3. Buscar PIX candidatos não vinculados no mês seguinte (5º ao 7º dia útil com tolerância no mês de pagamento)
      const pagoPixConfirmado = r2(soma.salario + soma.comissao + soma.complemento + soma.adiantamento_em_dia_salario);
      const faltaConfirmarPix = Math.max(0, r2(liquido - pagoPixConfirmado));
      const candidatosFolha = [];

      if ((folha.tipo || 'mensal') === 'mensal' && janela && faltaConfirmarPix > TOLERANCIA && liquido > 0) {
        const candsMesSeguinte = candidatosDisponiveis
          .filter(
            c =>
              !candidatosUsados.has(c.lancamento_id) &&
              c.chave_func === chaveFunc &&
              c.mes === janela.mes_pagamento &&
              c.valor <= Math.max(liquido * 1.5, liquido + 1000)
          )
          .map(c => {
            const naJanela = c.data >= janela.inicio && c.data <= janela.fim;
            const diffDiasQuinto = Math.abs(
              (Date.parse(c.data) - Date.parse(janela.inicio)) / 86400000
            );
            const diffValor = Math.abs(c.valor - faltaConfirmarPix);
            const grau = naJanela && diffValor <= TOLERANCIA ? 'alta' : diffDiasQuinto <= 4 ? 'alta' : 'media';
            return { ...c, na_janela_quinto_dia: naJanela, diffDiasQuinto, diffValor, grau_evidencia: grau };
          })
          .sort((a, b) => a.diffDiasQuinto - b.diffDiasQuinto || a.diffValor - b.diffValor);

        let restante = faltaConfirmarPix;
        for (const cand of candsMesSeguinte) {
          if (restante <= TOLERANCIA) break;
          // Se o candidato está nos primeiros 12 dias do mês seguinte (janela do 5º DU ± tolerância) ou bate com o valor
          if (cand.diffDiasQuinto <= 6 || cand.diffValor <= TOLERANCIA) {
            candidatosUsados.add(cand.lancamento_id);
            restante = r2(restante - cand.valor);
            const motivoCand = cand.na_janela_quinto_dia
              ? `PIX nominal encontrado exatamente na janela do 5º ao 7º dia útil (${janela.inicio} a ${janela.fim}) sem vínculo`
              : `PIX nominal encontrado no mês de pagamento (${cand.data}, próximo ao 5º dia útil ${janela.inicio}) sem vínculo`;
            candidatosFolha.push({
              lancamento_id: cand.lancamento_id,
              data: cand.data,
              valor: cand.valor,
              descricao: cand.descricao,
              na_janela_quinto_dia: cand.na_janela_quinto_dia,
              grau_evidencia: cand.grau_evidencia,
              motivo: motivoCand,
            });
            planoCorrecao.push({
              competencia: folha.competencia,
              funcionario: nomeCadastro,
              folha_id: folha.id,
              lancamento_id: cand.lancamento_id,
              acao: 'vincular_pix_quinto_dia',
              grau_evidencia: cand.grau_evidencia,
              quinto_dia_util: quinto_dia,
              data_evento: cand.data,
              valor_folha: liquido,
              valor_evento: cand.valor,
              vinculo_atual: soma.baixa_manual > 0 ? `Apenas baixa manual (R$ ${soma.baixa_manual.toFixed(2)})` : 'Sem vínculo no extrato',
              evidencia_descricao: cand.descricao,
              motivo: motivoCand,
            });
          }
        }
      }

      // 4. Determinar classificação da auditoria da competência
      // Se o PIX do extrato já quita a folha (dentro da tolerância), a baixa manual preservada não soma em dobro sobre o PIX
      const quitadaViaPixExtrato = liquido > 0 && pagoPixConfirmado >= liquido - TOLERANCIA;
      const pagoReconhecido = quitadaViaPixExtrato
        ? pagoPixConfirmado
        : r2(pagoPixConfirmado + soma.baixa_manual);

      const situacao = situacaoRastreio({
        liquido,
        pago: pagoReconhecido,
        aConfirmar: soma.a_confirmar,
        vencimento,
        hoje,
        coberturaExtrato: cobertura.status,
      });

      let classificacaoAuditoria = 'correto';
      let motivoAuditoria = `PIX conciliado conforme janela do 5º ao 7º dia útil (${quinto_dia || '—'} a ${vencimento || '—'})`;

      if (candidatosFolha.length > 0) {
        classificacaoAuditoria = 'candidato_sem_vinculo';
        motivoAuditoria = `${candidatosFolha.length} PIX nominal(is) localizado(s) no extrato de ${janela?.mes_pagamento} aguardando vínculo`;
      } else if (temRevisaoVinculo) {
        classificacaoAuditoria = 'revisar';
        motivoAuditoria = 'Vínculo requer revisão (salvo como vale no 5º dia útil, beneficiário divergente ou lançamento não-PIX)';
      } else if (temDuplicidadeManual && !quitadaViaPixExtrato) {
        classificacaoAuditoria = 'possivel_duplicidade';
        motivoAuditoria = 'Baixa manual com data de outra competência ou já vinculada via extrato no mês anterior';
      } else if (cobertura.status === 'ausente' && pagoPixConfirmado === 0) {
        classificacaoAuditoria = 'cobertura_insuficiente';
        motivoAuditoria = `Extrato bancário de ${janela?.mes_pagamento || 'pagamento'} ainda não importado — cobertura insuficiente`;
      } else if (liquido > 0 && pagoPixConfirmado === 0 && soma.baixa_manual === 0) {
        classificacaoAuditoria = 'sem_evidencia';
        motivoAuditoria = `Nenhum PIX ou baixa localizado para a janela ${quinto_dia || ''} a ${vencimento || ''}`;
      } else if (liquido - pagoReconhecido > TOLERANCIA) {
        classificacaoAuditoria = 'parcial';
        motivoAuditoria = `Pagamento parcial identificado (faltam R$ ${r2(liquido - pagoReconhecido).toFixed(2)})`;
      }

      const dataSalario =
        pix
          .filter(p => ['salario', 'adiantamento_em_dia_salario'].includes(p.tipo) && p.data)
          .map(p => p.data)
          .sort()[0] || null;

      if (!porFuncionario.has(nomeCadastro)) porFuncionario.set(nomeCadastro, []);
      porFuncionario.get(nomeCadastro).push({
        folha_id: folha.id,
        competencia: folha.competencia,
        tipo: folha.tipo || 'mensal',
        status: folha.status,
        liquido,
        vencimento,
        janela_inicio: quinto_dia,
        mes_pagamento: janela?.mes_pagamento || null,
        cobertura_extrato: cobertura.status,
        extrato_ate: cobertura.ate,
        data_salario: dataSalario,
        situacao,
        classificacao_auditoria: classificacaoAuditoria,
        motivo_auditoria: motivoAuditoria,
        pix_salario: r2(soma.salario + soma.adiantamento_em_dia_salario),
        pix_comissao: r2(soma.comissao),
        pix_complemento: r2(soma.complemento),
        baixa_manual: r2(soma.baixa_manual),
        pix_adiantamentos: r2(soma.adiantamento),
        pix_a_confirmar: r2(soma.a_confirmar),
        pix_suspeito: r2(soma.suspeito + soma.outro_beneficiario + soma.nao_pix),
        total_pago_pix: pagoPixConfirmado,
        total_pago: pagoReconhecido,
        diferenca: r2(liquido - pagoReconhecido),
        pix: pix.sort((a, b) => (a.data || '').localeCompare(b.data || '')),
        candidatos_pix: candidatosFolha,
      });
    }

    // Lista de PIX nominais não vinculados (enriquecida com sugestão de competência se caiu no 5º-7º DU)
    const naoRastreados = candidatosDisponiveis
      .filter(c => ! setCompetenciasAtivas || c.data >= `${competencias12m[0]}-01`)
      .map(c => {
        const [a, m] = c.mes.split('-').map(Number);
        const compAnterior = new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 7);
        const janAnt = periodoPagamentoFolha(compAnterior);
        const naJanela = janAnt && c.data >= janAnt.inicio && c.data <= janAnt.fim;
        return {
          funcionario: c.funcionario,
          data: c.data,
          valor: c.valor,
          descricao: c.descricao,
          lancamento_id: c.lancamento_id,
          competencia_sugerida: Number(c.data.slice(8, 10)) <= 10 ? compAnterior : c.mes,
          na_janela_quinto_dia: Boolean(naJanela),
        };
      })
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const relatorio = [...porFuncionario.entries()]
      .map(([nome, comps]) => {
        comps.sort((a, b) => b.competencia.localeCompare(a.competencia));
        const s = k => r2(comps.reduce((t, c) => t + (c[k] || 0), 0));
        return {
          funcionario: nome,
          total_liquido: s('liquido'),
          total_pago_pix: s('total_pago_pix'),
          total_baixa_manual: s('baixa_manual'),
          total_pago: s('total_pago'),
          total_adiantamentos: s('pix_adiantamentos'),
          total_a_confirmar: s('pix_a_confirmar'),
          competencias: comps,
        };
      })
      .sort((a, b) => a.funcionario.localeCompare(b.funcionario));

    const todas = relatorio.flatMap(f => f.competencias);
    const saldoDe = lista => r2(lista.reduce((t, c) => t + Math.max(0, c.diferenca), 0));

    // Resumo mês a mês para os 12 meses auditados
    const competenciasLista = mesesFiltro > 0
      ? ultimasCompetencias(hoje, mesesFiltro)
      : [...new Set(todas.map(c => c.competencia))].sort();

    const resumoMeses = competenciasLista
      .slice()
      .reverse()
      .map(comp => {
        const jan = periodoPagamentoFolha(comp);
        const cob = avaliarCoberturaMesPagamento(jan);
        const itensMes = todas.filter(c => c.competencia === comp);
        return {
          competencia: comp,
          mes_pagamento: jan?.mes_pagamento || null,
          quinto_dia_util: jan?.inicio || null,
          setimo_dia_util: jan?.fim || null,
          cobertura_extrato: cob.status,
          extrato_ate: cob.ate,
          total_folhas: itensMes.length,
          total_liquido: r2(itensMes.reduce((s, i) => s + i.liquido, 0)),
          total_pix_confirmado: r2(itensMes.reduce((s, i) => s + i.total_pago_pix, 0)),
          total_baixa_manual: r2(itensMes.reduce((s, i) => s + i.baixa_manual, 0)),
          qtd_corretos: itensMes.filter(i => i.classificacao_auditoria === 'correto').length,
          qtd_candidatos: itensMes.filter(i => i.classificacao_auditoria === 'candidato_sem_vinculo').length,
          qtd_revisar: itensMes.filter(i => i.classificacao_auditoria === 'revisar').length,
          qtd_duplicidades: itensMes.filter(i => i.classificacao_auditoria === 'possivel_duplicidade').length,
          qtd_sem_evidencia: itensMes.filter(i => ['sem_evidencia', 'cobertura_insuficiente'].includes(i.classificacao_auditoria)).length,
        };
      });

    const resumoAuditoria = {
      total_folhas: todas.length,
      corretos: todas.filter(c => c.classificacao_auditoria === 'correto').length,
      candidatos_sem_vinculo: todas.filter(c => c.classificacao_auditoria === 'candidato_sem_vinculo').length,
      valor_candidatos: r2(
        todas.reduce((s, c) => s + (c.candidatos_pix || []).reduce((k, p) => k + p.valor, 0), 0)
      ),
      revisar: todas.filter(c => c.classificacao_auditoria === 'revisar').length,
      duplicidades: todas.filter(c => c.classificacao_auditoria === 'possivel_duplicidade').length,
      parciais: todas.filter(c => c.classificacao_auditoria === 'parcial').length,
      sem_evidencia: todas.filter(c => c.classificacao_auditoria === 'sem_evidencia').length,
      cobertura_insuficiente: todas.filter(c => c.classificacao_auditoria === 'cobertura_insuficiente').length,
    };

    return Response.json({
      success: true,
      somente_leitura: !execucaoCorrecao,
      execucao_correcao: execucaoCorrecao,
      gerado_em: new Date().toISOString(),
      hoje,
      janela_auditoria: {
        meses: mesesFiltro || competenciasLista.length,
        inicio: competenciasLista[0] || null,
        fim: competenciasLista[competenciasLista.length - 1] || null,
        label: mesesFiltro > 0 ? `Últimos ${mesesFiltro} meses (${competenciasLista[0]} a ${competenciasLista[competenciasLista.length - 1]})` : 'Histórico Completo',
      },
      totais: {
        devido: r2(todas.reduce((t, c) => t + c.liquido, 0)),
        pago_pix_extrato: r2(todas.reduce((t, c) => t + c.total_pago_pix, 0)),
        baixa_manual_total: r2(todas.reduce((t, c) => t + c.baixa_manual, 0)),
        pago: r2(todas.reduce((t, c) => t + c.total_pago, 0)),
        vales: r2(todas.reduce((t, c) => t + c.pix_adiantamentos, 0)),
        a_confirmar: r2(todas.reduce((t, c) => t + c.pix_a_confirmar, 0)),
        vencido: saldoDe(todas.filter(c => ['vencida', 'parcial'].includes(c.situacao))),
        a_vencer: saldoDe(todas.filter(c => ['a_vencer', 'parcial_a_vencer'].includes(c.situacao))),
      },
      resumo_auditoria: resumoAuditoria,
      resumo_meses: resumoMeses,
      plano_correcao: planoCorrecao.sort((a, b) => (b.competencia || '').localeCompare(a.competencia || '') || a.funcionario.localeCompare(b.funcionario)),
      funcionarios: relatorio,
      pix_nao_rastreados: naoRastreados,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}