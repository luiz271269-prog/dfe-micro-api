import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { criarVerificacao } from './regras.ts';

async function* paginas(entidade, filtro = {}) {
  let cursor;
  do {
    const pagina = await entidade.filter(filtro, { sort: 'id', limit: 250, ...(cursor ? { cursor } : {}) });
    yield pagina.items;
    if (pagina.has_more && (!pagina.next_cursor || pagina.next_cursor === cursor)) throw new Error('Paginação incompleta.');
    cursor = pagina.has_more ? pagina.next_cursor : undefined;
  } while (cursor);
}

async function percorrer(entidade, filtro, ler) {
  let total = 0;
  for await (const itens of paginas(entidade, filtro)) { for (const item of itens) ler(item); total += itens.length; }
  return total;
}

async function salvar(db, achados, agora, inicio) {
  const entity = db.ApontamentoRecebivel;
  const anteriores = new Map();
  await percorrer(entity, {}, a => anteriores.set(a.chave, a));
  const alteracoes = [...achados.values()].map(a => {
    const anterior = anteriores.get(a.chave);
    return { ...a, ativo: true, detectado_em: anterior?.detectado_em || agora, visto_em: agora };
  });
  for (let i = 0; i < alteracoes.length; i += 250) await entity.upsert(alteracoes.slice(i, i + 250), { key: 'chave' });
  const inativos = [...anteriores.values()].filter(a => a.ativo && a.visto_em < inicio && !achados.has(a.chave));
  for (let i = 0; i < inativos.length; i += 250) {
    await entity.bulkUpdate(inativos.slice(i, i + 250).map(a => ({ id: a.id, ativo: false, inativado_em: agora })));
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return Response.json({ error: 'Autenticação necessária.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;
    const inicio = new Date().toISOString();
    const motor = criarVerificacao();
    const notas = await percorrer(db.NotaFiscal, { tipo: 'NF', status: { $ne: 'anulada' }, is_espelho_ci: { $ne: true } }, motor.lerNota);
    const parcelas = await percorrer(db.TituloCobranca, {}, motor.lerParcela);
    const achados = motor.concluir();
    const totais = { total_parcelas: 0, vinculo: 0, valor_pago: 0, status: 0 };
    for (const a of achados.values()) totais[a.grupo]++;
    const fim = new Date();
    const agora = fim.toISOString();
    if (body.somente_previa !== true) {
      await salvar(db, achados, agora, inicio);
      const dia = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(fim);
      await db.VerificacaoRecebiveis.upsert([{ dia, concluida_em: agora, notas, parcelas, totais }], { key: 'dia' });
    }
    return Response.json({ success: true, previa: body.somente_previa === true, notas, parcelas, totais });
  } catch (error) {
    console.error('Verificação de recebíveis:', error.message);
    return Response.json({ error: 'Não foi possível concluir a verificação de recebíveis.' }, { status: 500 });
  }
}