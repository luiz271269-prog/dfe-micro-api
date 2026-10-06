import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { criarFolhaValidada, impedimentoFolha, queryFuncionario } from '../../shared/folhaRegras.ts';

function proximaCompetencia(comp) {
  const [ano, mes] = comp.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function(req) {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    if (body.competencia && !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.competencia)) return Response.json({ error: 'Competência inválida.' }, { status: 400 });
    const svc = client.entities;
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
    const hoje = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
    const competenciaAlvo = body.competencia || proximaCompetencia(hoje);
    const dryRun = body.validate_only === true;
    const detalhes = [];
    let cursor, avaliados = 0;
    do {
      const page = await svc.Funcionario.filter(body.competencia ? {} : { status: { $in: ['ativo', 'ferias'] } }, { sort: 'id', limit: 50, cursor });
      for (const func of page.items) {
        avaliados++;
        const query = queryFuncionario(func);
        const modelos = await svc.FolhaPagamento.filter({ ...query, $and: [{ $or: [{ tipo: 'mensal' }, { tipo: { $exists: false } }] }], competencia: { $lt: competenciaAlvo } }, { sort: '-competencia', limit: 1 });
        const modelo = modelos.items[0];
        let comp = body.competencia || (modelo ? proximaCompetencia(modelo.competencia) : competenciaAlvo);
        const planejadas = new Set();
        for (let guarda = 0; comp <= competenciaAlvo && guarda < 12; guarda++, comp = proximaCompetencia(comp)) {
          if (await impedimentoFolha(svc, func, comp)) continue;
          if (await svc.FolhaPagamento.count({ ...query, competencia: comp })) continue;
          const bruto = modelo?.salario_bruto ?? func.salario_base ?? 0;
          const eventos = (modelo?.eventos || []).filter(e => e.recorrente).map(e => ({ ...e }));
          const soma = tipo => eventos.filter(e => e.tipo === tipo).reduce((s, e) => s + (e.valor || 0), 0);
          const nova = { funcionario_id: func.id, funcionario_nome: func.nome, competencia: comp, tipo: 'mensal', salario_bruto: bruto,
            horas_extras: 0, comissao: 0, eventos, status: 'pendente', fgts_valor: modelo?.fgts_valor || 0,
            empresa: func.empresa, origem_compra: 'empresa', tipo_compra: 'folha', gerada_automaticamente: true };
          for (const campo of ['desconto_inss','desconto_irrf','desconto_vt','desconto_vr','outros_descontos']) nova[campo] = modelo?.[campo] || 0;
          const descontos = nova.desconto_inss + nova.desconto_irrf + nova.desconto_vt + nova.desconto_vr + nova.outros_descontos + soma('desconto');
          nova.salario_liquido = Math.round((bruto + soma('provento') - descontos) * 100) / 100;
          if (!dryRun) await criarFolhaValidada(svc, nova);
          planejadas.add(comp);
          detalhes.push({ funcionario: func.nome, competencia: comp, liquido: nova.salario_liquido });
        }
        if (!func.ferias_inicio) continue;
        const compFerias = func.ferias_inicio.slice(0, 7);
        if (body.competencia && compFerias !== body.competencia) continue;
        if (new Date(func.ferias_inicio + 'T00:00:00Z').getTime() - Date.now() > 30 * 86400000) continue;
        if (planejadas.has(compFerias) || await impedimentoFolha(svc, func, compFerias, 'ferias')) continue;
        if (await svc.FolhaPagamento.count({ ...query, competencia: compFerias })) continue;
        const dias = func.ferias_fim ? Math.round((Date.parse(func.ferias_fim) - Date.parse(func.ferias_inicio)) / 86400000) + 1 : 30;
        const valor = Math.round((func.salario_base || 0) / 30 * dias * 4 / 3 * 100) / 100;
        if (valor <= 0) continue;
        if (!dryRun) await criarFolhaValidada(svc, { funcionario_id: func.id, competencia: compFerias, tipo: 'ferias', salario_bruto: valor, salario_liquido: valor, status: 'pendente', origem_compra: 'empresa', tipo_compra: 'folha', gerada_automaticamente: true });
        detalhes.push({ funcionario: func.nome, competencia: compFerias, liquido: valor });
      }
      cursor = page.has_more ? page.next_cursor : null;
    } while (cursor);
    return Response.json({ success: true, mode: dryRun ? 'validation' : 'generation', competencia_alvo: competenciaAlvo, funcionarios_avaliados: avaliados, folhas_geradas: dryRun ? 0 : detalhes.length, folhas_previstas: detalhes.length, detalhes });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}