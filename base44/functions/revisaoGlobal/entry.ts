import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { DETECTORES } from './detectores.ts';

const LIMITE = 300;
const chaveDe = (d, r) => `${d.id}:${r.id}`;

async function contexto(db) {
  const limite30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [despesas, cartao] = await Promise.all([
    db.DespesaOperacional.filter({}, { sort: '-created_date', limit: LIMITE }),
    db.LancamentoCartao.filter({}, { sort: '-created_date', limit: LIMITE }),
  ]);
  return { limite30, despesas: despesas.items, cartao: cartao.items };
}

function item(d, r, ctx) {
  const base = d.montar(r, ctx);
  return { chave: chaveDe(d, r), detector: d.id, modulo: d.modulo, rota: d.rota, entidade_tipo: d.entidade, entidade_id: r.id, ...base };
}

async function listar(db) {
  const ctx = await contexto(db);
  const decisoes = (await db.DecisaoRevisao.filter({}, { sort: '-decidido_em', limit: 500 })).items;
  const porChave = {};
  decisoes.forEach(x => { if (!porChave[x.chave]) porChave[x.chave] = x; });
  const leituras = await Promise.allSettled(DETECTORES.map(d => db[d.entidade].filter(d.query, { sort: '-created_date', limit: LIMITE })));
  const itens = [], modulos = [];
  leituras.forEach((res, i) => {
    const d = DETECTORES[i];
    if (res.status === 'rejected') return modulos.push({ detector: d.id, modulo: d.modulo, lido: false, erro: res.reason?.message });
    const achados = res.value.items.filter(r => d.condicao(r, ctx));
    modulos.push({ detector: d.id, modulo: d.modulo, lido: true, parcial: res.value.has_more, encontrados: achados.length });
    achados.slice(0, 60).forEach(r => {
      const it = item(d, r, ctx), dec = porChave[it.chave];
      it.estado = dec ? dec.estado : it.procedimentos.some(p => p.sugerido) || it.procedimentos.length ? 'pendente' : 'sem_sugestao';
      if (!it.procedimentos.length) it.estado = 'sem_sugestao';
      if (dec) it.decisao = { procedimento_rotulo: dec.procedimento_rotulo, decidido_por: dec.decidido_por, decidido_em: dec.decidido_em };
      itens.push(it);
    });
  });
  // Itens já corrigidos saem dos detectores; o histórico mostra a decisão aplicada.
  const presentes = new Set(itens.map(i => i.chave));
  decisoes.filter(x => x.estado === 'aplicada' && !presentes.has(x.chave)).slice(0, 100).forEach(x => {
    presentes.add(x.chave);
    const salvo = JSON.parse(x.item_json || '{}');
    itens.push({ ...salvo, procedimentos: [], estado: 'aplicada', decisao: { procedimento_rotulo: x.procedimento_rotulo, decidido_por: x.decidido_por, decidido_em: x.decidido_em } });
  });
  return { itens, modulos };
}

async function decidir(db, user, body) {
  const { chave, procedimento_id, alternativa = '', adiar } = body;
  const [detId, id] = String(chave || '').split(':');
  const d = DETECTORES.find(x => x.id === detId);
  if (!d || !id) return [400, { error: 'Item inválido.' }];
  const anterior = (await db.DecisaoRevisao.filter({ chave, estado: { $in: ['aplicada', 'registrada'] } }, { limit: 1 })).items[0];
  if (anterior) return [200, { success: true, ja_decidido: true, decisao: anterior }];
  const registro = await db[d.entidade].get(id).catch(e => (e.status === 404 ? null : Promise.reject(e)));
  if (!registro) return [404, { error: 'Registro não encontrado.' }];
  const ctx = await contexto(db);
  if (!d.condicao(registro, ctx)) return [409, { error: 'A situação já não se aplica a este registro. Atualize a revisão.' }];
  const it = item(d, registro, ctx);
  const base = { chave, detector: d.id, modulo: d.modulo, entidade_tipo: d.entidade, entidade_id: id, item_json: JSON.stringify({ ...it, procedimentos: [] }).slice(0, 8000), decidido_por: user.email, decidido_em: new Date().toISOString() };
  if (adiar) return [200, { success: true, decisao: await db.DecisaoRevisao.create({ ...base, estado: 'adiada', procedimento_rotulo: 'Adiado' }) }];
  const p = it.procedimentos.find(x => x.id === procedimento_id);
  if (!p || p.tipo === 'abrir') return [400, { error: 'Procedimento inválido.' }];
  let patch = p.patch || {};
  if (p.alternativa) {
    const valor = String(alternativa).trim();
    if (!valor) return [400, { error: 'Informe a escolha.' }];
    if (p.alternativa.opcoes && !p.alternativa.opcoes.some(o => o.valor === valor)) return [400, { error: 'Opção inválida.' }];
    if (p.tipo === 'aplicar') {
      const v = p.alternativa.numero ? parseFloat(valor.replace(/\./g, '').replace(',', '.')) : valor;
      if (p.alternativa.numero && !(v > 0)) return [400, { error: 'Valor inválido.' }];
      patch = { [p.alternativa.campo]: v };
    }
  }
  const antes = Object.fromEntries(Object.keys(patch).map(k => [k, registro[k] ?? null]));
  if (p.tipo === 'aplicar') await db[d.entidade].update(id, patch);
  const decisao = await db.DecisaoRevisao.create({ ...base, estado: p.tipo === 'aplicar' ? 'aplicada' : 'registrada', procedimento_id: p.id, procedimento_rotulo: p.rotulo, alternativa: String(alternativa).slice(0, 1000), antes_json: JSON.stringify(antes), depois_json: JSON.stringify(patch) });
  return [200, { success: true, decisao }];
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;
    if (body.acao === 'decidir') { const [status, res] = await decidir(db, user, body); return Response.json(res, { status }); }
    return Response.json(await listar(db));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}