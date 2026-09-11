import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getAppsFinanceiros, listarRegistrosExternos, atualizarRegistroExterno, normalizarRegistro } from '../../shared/appsFinanceiros.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const db = base44.asServiceRole.entities;
    const locais = await db.IntegracaoFinanceira.list('-updated_date', 5000);
    const configs = getAppsFinanceiros();
    let enviados = 0;
    const erros = [];
    for (const local of locais.filter(item => item.pendente_envio)) {
      try {
        const config = configs[local.app_origem];
        const alteracoes = {};
        if (local.campo_valor) alteracoes[local.campo_valor] = local.valor;
        if (local.campo_status) alteracoes[local.campo_status] = local.status;
        if (Object.keys(alteracoes).length) await atualizarRegistroExterno(config, local.entidade_externa, local.registro_externo_id, alteracoes);
        await db.IntegracaoFinanceira.update(local.id, { pendente_envio: false, erro_sync: '', ultima_sincronizacao: new Date().toISOString() });
        enviados += 1;
      } catch (error) {
        await db.IntegracaoFinanceira.update(local.id, { erro_sync: error.message });
        erros.push(`${local.app_origem}/${local.entidade_externa}: ${error.message}`);
      }
    }
    const atuais = await db.IntegracaoFinanceira.list('-updated_date', 5000);
    const porChave = new Map(atuais.map(item => [`${item.app_origem}:${item.entidade_externa}:${item.registro_externo_id}`, item]));
    const criar = [];
    const atualizar = [];
    const fontes = [];
    for (const [app, config] of Object.entries(configs)) {
      for (const spec of config.entidades) {
        try {
          const registros = await listarRegistrosExternos(config, spec.nome);
          fontes.push({ app, entidade: spec.nome, registros: registros.length });
          for (const registro of registros) {
            if (!registro.id) continue;
            const chave = `${app}:${spec.nome}:${registro.id}`;
            const local = porChave.get(chave);
            if (local?.pendente_envio) continue;
            const normalizado = normalizarRegistro(app, spec.nome, spec.tipo, registro);
            if (local) atualizar.push({ id: local.id, ...normalizado });
            else criar.push(normalizado);
          }
        } catch (error) {
          erros.push(`${app}/${spec.nome}: ${error.message}`);
        }
      }
    }
    if (criar.length) await db.IntegracaoFinanceira.bulkCreate(criar);
    if (atualizar.length) await db.IntegracaoFinanceira.bulkUpdate(atualizar);
    return Response.json({ ok: erros.length === 0, recebidos: criar.length, atualizados: atualizar.length, enviados, fontes, erros });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}