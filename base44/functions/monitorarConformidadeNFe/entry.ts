import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Automação: disparada em CREATE/UPDATE de NFeAnalise.
// Se score_conformidade < 60 ou houver divergências de alta severidade,
// cria NotificacaoConformidade e envia e-mail ao admin.

const SCORE_LIMITE = 60;

function classificarDivergencias(analise) {
  const divergenciasFiscais = analise.divergencias_fiscais || [];
  const divergencias = analise.divergencias || [];
  const alertasGeral = analise.alertas_conformidade || [];
  const categorias = new Set();
  const detalhes = [];

  // Classifica divergencias_fiscais (produto-nível)
  for (const d of divergenciasFiscais) {
    const obs = (d.observacao || '').toLowerCase();
    let tipo = 'outro';
    if (obs.includes('ncm')) tipo = 'ncm_invalido';
    else if (obs.includes('alíquota') || obs.includes('aliquota')) tipo = 'aliquota_atipica';
    else if (obs.includes('valor') && obs.includes('pedido')) tipo = 'valor_divergente';
    else if (obs.includes('cst') || obs.includes('csosn')) tipo = 'cst_inconsistente';
    else if (obs.includes('aritmético') || obs.includes('aritmetico') || obs.includes('icms aritmético')) tipo = 'aritmetica_icms';
    else if (obs.includes('cfop')) tipo = 'cst_inconsistente';

    categorias.add(tipo);
    detalhes.push({ tipo, produto: d.produto || '—', descricao: d.observacao || '' });
  }

  // Divergências comparativas NF-e vs pedido (nível NF)
  for (const d of divergencias) {
    const txt = (d || '').toLowerCase();
    let tipo = 'valor_divergente';
    if (txt.includes('nenhum pedido')) tipo = 'sem_pedido';
    else if (txt.includes('não encontrado')) tipo = 'sem_pedido';
    else if (txt.includes('qtd')) tipo = 'valor_divergente';
    categorias.add(tipo);
    detalhes.push({ tipo, produto: '—', descricao: d });
  }

  // Alertas gerais
  for (const a of alertasGeral) {
    const txt = (a || '').toLowerCase();
    let tipo = 'aritmetica_icms';
    if (txt.includes('simples') || txt.includes('icms')) tipo = 'aritmetica_icms';
    categorias.add(tipo);
    detalhes.push({ tipo, produto: '—', descricao: a });
  }

  return { categorias: [...categorias], detalhes: detalhes.slice(0, 20) };
}

function tituloAlerta(categorias, score) {
  const labels = {
    ncm_invalido: 'NCM inválido',
    aliquota_atipica: 'Alíquota atípica',
    valor_divergente: 'Valor divergente do pedido',
    cst_inconsistente: 'CST/CFOP inconsistente',
    aritmetica_icms: 'Inconsistência aritmética',
    sem_pedido: 'NF-e sem pedido correspondente',
  };
  const nomes = categorias.map(c => labels[c]).filter(Boolean);
  if (nomes.length === 0) return `Score de conformidade baixo (${score})`;
  if (nomes.length === 1) return nomes[0];
  return `${nomes.length} tipos de divergência: ${nomes.slice(0, 2).join(', ')}${nomes.length > 2 ? '…' : ''}`;
}

function montarEmail(analise, categorias, detalhes) {
  const labels = {
    ncm_invalido: 'NCM inválido/ausente',
    aliquota_atipica: 'Alíquota atípica',
    valor_divergente: 'Valor divergente do pedido',
    cst_inconsistente: 'CST/CFOP inconsistente',
    aritmetica_icms: 'Inconsistência aritmética',
    sem_pedido: 'Sem pedido correspondente',
  };
  const categoriasFmt = categorias.map(c => `• ${labels[c] || c}`).join('\n');
  const detalhesFmt = detalhes.slice(0, 10).map(d => `  - [${d.tipo}] ${d.produto}: ${d.descricao}`).join('\n');

  return `Alerta de Conformidade Fiscal — NeuralFin

NF-e ${analise.numero_nota || '—'} · ${analise.emitente_nome || '—'}
Data de emissão: ${analise.data_emissao || '—'}
Valor total: R$ ${(analise.valor_total || 0).toFixed(2)}
Score de conformidade: ${analise.score_conformidade || 0}/100

━━━━━━━━━━━━━━━━━━━━━━━
NATUREZA DAS DIVERGÊNCIAS:
${categoriasFmt}

DETALHES:
${detalhesFmt}
━━━━━━━━━━━━━━━━━━━━━━━

Acesse o painel NeuralFin para revisar essa NF-e no módulo "Análise XML NF-e".
`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    // Pode ser chamada pela automation (traz data/old_data) OU manualmente (traz nfe_analise_id)
    let analise;
    if (payload.event && payload.data) {
      analise = payload.data;
      // Evitar disparos repetidos: se for update e o score não mudou, ignorar
      if (payload.event.type === 'update' && payload.old_data) {
        const antes = payload.old_data.score_conformidade;
        const depois = analise.score_conformidade;
        if (antes === depois) {
          return Response.json({ skipped: true, reason: 'score_inalterado' });
        }
      }
    } else if (payload.nfe_analise_id) {
      analise = await base44.asServiceRole.entities.NFeAnalise.get(payload.nfe_analise_id);
    } else {
      return Response.json({ error: 'Payload deve conter event+data ou nfe_analise_id' }, { status: 400 });
    }

    if (!analise) return Response.json({ error: 'Análise não encontrada' }, { status: 404 });

    const score = analise.score_conformidade ?? 100;
    const temDivergenciaAlta = (analise.divergencias_fiscais || []).some(d => d.severidade === 'alta');

    // Dispara somente se score baixo OU houver divergências de alta severidade
    if (score >= SCORE_LIMITE && !temDivergenciaAlta) {
      return Response.json({ skipped: true, reason: 'score_ok', score });
    }

    // Evitar duplicidade: se já existe notificação ativa para esta NFeAnalise, atualizar em vez de criar
    const existentes = await base44.asServiceRole.entities.NotificacaoConformidade.filter({
      nfe_analise_id: analise.id,
      resolvida: false,
    });

    const { categorias, detalhes } = classificarDivergencias(analise);
    const tipo = categorias[0] || 'score_baixo';
    const titulo = tituloAlerta(categorias, score);
    const severidade = score < 40 ? 'alta' : score < SCORE_LIMITE ? 'media' : 'baixa';

    const mensagem = `NF-e ${analise.numero_nota || '?'} de ${analise.emitente_nome || '?'} foi processada com score ${score}/100. ${categorias.length} tipo(s) de divergência detectado(s).`;

    const dadosNotif = {
      tipo,
      severidade,
      titulo,
      mensagem,
      nfe_analise_id: analise.id,
      nfe_numero: analise.numero_nota,
      emitente_nome: analise.emitente_nome,
      score_conformidade: score,
      detalhes,
      lida: false,
      resolvida: false,
    };

    let notif;
    if (existentes.length > 0) {
      notif = await base44.asServiceRole.entities.NotificacaoConformidade.update(existentes[0].id, dadosNotif);
    } else {
      notif = await base44.asServiceRole.entities.NotificacaoConformidade.create(dadosNotif);
    }

    // Envio de e-mail para o admin (usuário autenticado / criador da NF-e)
    let emailEnviado = false;
    try {
      // Buscar admins da app
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const destinatario = admins?.[0]?.email || analise.created_by;
      if (destinatario && !notif.email_enviado) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: destinatario,
          subject: `[NeuralFin] ⚠ Conformidade Fiscal — NF-e ${analise.numero_nota} (score ${score})`,
          body: montarEmail(analise, categorias, detalhes),
          from_name: 'NeuralFin Conformidade',
        });
        await base44.asServiceRole.entities.NotificacaoConformidade.update(notif.id, {
          email_enviado: true,
          destinatario_email: destinatario,
        });
        emailEnviado = true;
      }
    } catch (emailErr) {
      console.log('Falha ao enviar e-mail:', emailErr.message);
    }

    return Response.json({
      ok: true,
      notificacao_id: notif.id,
      score,
      categorias,
      email_enviado: emailEnviado,
    });
  } catch (error) {
    console.error('Erro monitorarConformidadeNFe:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});