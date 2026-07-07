import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Gera folhas de pagamento pendentes clonando sempre a última folha do funcionário.
// Regra de negócio: a folha de competência M é paga no 5º dia útil de M+1,
// portanto a última competência que deve existir é o MÊS ANTERIOR ao atual.
// - Para cada funcionário ativo (ou de férias), gera as competências faltantes
//   desde a última folha registrada até o mês anterior ao atual.
// - Clona salário bruto, descontos, FGTS e empresa da última folha mensal.
//   Comissão e horas extras (variáveis) começam zeradas.
// - Idempotente: nunca duplica competência já existente (qualquer tipo).

function normalizar(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function proximaCompetencia(comp) {
  const [ano, mes] = comp.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes, 1)); // mes é 1-based → Date UTC mes = próximo
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
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

    const [funcionarios, folhas] = await Promise.all([
      svc.Funcionario.list('', 200),
      svc.FolhaPagamento.list('-competencia', 1000),
    ]);

    // Competência alvo = mês anterior ao atual (folha de M é paga em M+1)
    const hoje = new Date();
    const alvoDate = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1));
    const competenciaAlvo = `${alvoDate.getUTCFullYear()}-${String(alvoDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const ativos = funcionarios.filter(f => f.status === 'ativo' || f.status === 'ferias');
    const geradas = [];
    const detalhes = [];

    for (const func of ativos) {
      const nomeNorm = normalizar(func.nome);
      // Folhas deste funcionário (match flexível de nome, igual ao motor de conciliação)
      const folhasFunc = folhas.filter(fl => {
        const n = normalizar(fl.funcionario_nome);
        return n === nomeNorm || nomeNorm.includes(n) || n.includes(nomeNorm);
      }).sort((a, b) => (b.competencia || '').localeCompare(a.competencia || ''));

      const competenciasExistentes = new Set(folhasFunc.filter(fl => (fl.tipo || 'mensal') === 'mensal').map(fl => fl.competencia));
      // Modelo = última folha MENSAL registrada (clona valores fixos)
      const modelo = folhasFunc.find(fl => (fl.tipo || 'mensal') === 'mensal');

      // Ponto de partida: mês seguinte à última folha; sem histórico → só a competência alvo
      let comp = modelo ? proximaCompetencia(modelo.competencia) : competenciaAlvo;

      let guarda = 0;
      while (comp <= competenciaAlvo && guarda < 12) {
        guarda++;
        if (!competenciasExistentes.has(comp)) {
          const bruto = modelo?.salario_bruto ?? func.salario_base ?? 0;
          const descontos = modelo
            ? (modelo.desconto_inss || 0) + (modelo.desconto_irrf || 0) + (modelo.desconto_vt || 0) + (modelo.desconto_vr || 0) + (modelo.outros_descontos || 0)
            : 0;
          const nova = {
            funcionario_id: func.id,
            funcionario_nome: modelo?.funcionario_nome || func.nome,
            competencia: comp,
            tipo: 'mensal',
            salario_bruto: bruto,
            desconto_inss: modelo?.desconto_inss || 0,
            desconto_irrf: modelo?.desconto_irrf || 0,
            desconto_vt: modelo?.desconto_vt || 0,
            desconto_vr: modelo?.desconto_vr || 0,
            outros_descontos: modelo?.outros_descontos || 0,
            horas_extras: 0,
            comissao: 0,
            salario_liquido: bruto - descontos,
            status: 'pendente',
            fgts_valor: modelo?.fgts_valor || 0,
            empresa: modelo?.empresa || func.empresa,
            gerada_automaticamente: true,
          };
          const criada = await svc.FolhaPagamento.create(nova);
          geradas.push(criada.id);
          detalhes.push({ funcionario: nova.funcionario_nome, competencia: comp, liquido: nova.salario_liquido, base: modelo ? `folha ${modelo.competencia}` : 'salário base do cadastro' });
        }
        comp = proximaCompetencia(comp);
      }
    }

    // FÉRIAS — gera folha de férias (salário + 1/3) quando há período registrado no cadastro.
    // Regra: férias são pagas até 2 dias ANTES do início, então gera assim que o início
    // estiver a até 30 dias à frente (ou já tiver passado).
    for (const func of ativos) {
      if (!func.ferias_inicio) continue;
      const inicioFerias = new Date(func.ferias_inicio + 'T00:00:00Z');
      if (inicioFerias.getTime() - Date.now() > 30 * 86400000) continue;

      const compFerias = `${inicioFerias.getUTCFullYear()}-${String(inicioFerias.getUTCMonth() + 1).padStart(2, '0')}`;
      const nomeNorm = normalizar(func.nome);
      const jaExiste = folhas.some(fl => {
        if (fl.tipo !== 'ferias' || fl.competencia !== compFerias) return false;
        const n = normalizar(fl.funcionario_nome);
        return n === nomeNorm || nomeNorm.includes(n) || n.includes(nomeNorm);
      });
      if (jaExiste) continue;

      const fimFerias = func.ferias_fim ? new Date(func.ferias_fim + 'T00:00:00Z') : null;
      const dias = fimFerias ? Math.round((fimFerias.getTime() - inicioFerias.getTime()) / 86400000) + 1 : 30;
      const base = func.salario_base || 0;
      const valorFerias = Math.round((base / 30) * dias * (4 / 3) * 100) / 100;
      if (valorFerias <= 0) continue;

      const criada = await svc.FolhaPagamento.create({
        funcionario_id: func.id,
        funcionario_nome: func.nome,
        competencia: compFerias,
        tipo: 'ferias',
        salario_bruto: valorFerias,
        salario_liquido: valorFerias,
        status: 'pendente',
        empresa: func.empresa,
        gerada_automaticamente: true,
      });
      geradas.push(criada.id);
      detalhes.push({ funcionario: func.nome, competencia: compFerias, liquido: valorFerias, base: `férias ${dias} dia(s) + 1/3` });
    }

    return Response.json({
      success: true,
      competencia_alvo: competenciaAlvo,
      funcionarios_avaliados: ativos.length,
      folhas_geradas: geradas.length,
      detalhes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});