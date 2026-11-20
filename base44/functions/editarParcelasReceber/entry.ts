import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { lerParcelasReceber, planejarParcelasReceber } from '../../shared/editarParcelasReceber.ts';
import { reservarRegistroBaixa, liberarRegistroBaixa } from '../../shared/baixasReserva.ts';

const erro = (error, status) => Response.json({ error }, { status });
const obter = (entidade, id) => entidade.get(id).catch(e => (e.status ?? e.response?.status) === 404 ? null : Promise.reject(e));

export default async function(req: Request): Promise<Response> {
  const reservas = [];
  let db;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => (e.status ?? e.response?.status) === 401 ? null : Promise.reject(e));
    if (!user) return erro('Entre para consultar as parcelas.', 401);
    if (user.role !== 'admin') return erro('A edição de parcelas é restrita a administradores.', 403);
    const body = await req.json().catch(() => null);
    if (!['consultar', 'validar', 'salvar'].includes(body?.acao) || typeof body.titulo_id !== 'string' || !/^[a-zA-Z\d_-]{1,80}$/.test(body.titulo_id)) return erro('Informe o título a receber.', 400);
    db = base44.entities;
    const titulo = await obter(db.TituloCobranca, body.titulo_id);
    if (!titulo?.nota_fiscal_id) return erro('Título sem nota fiscal ou CI vinculado.', 404);
    const nota = await obter(db.NotaFiscal, titulo.nota_fiscal_id);
    if (!nota) return erro('Nota fiscal ou CI não encontrado.', 404);
    const { items, ...estado } = await lerParcelasReceber(db, nota);
    if (body.acao === 'consultar') return Response.json(estado);
    if (estado.bloqueio) return erro(estado.bloqueio, 409);
    if (body.versao !== estado.versao) return erro('As parcelas ou a nota mudaram. Feche e abra o editor para atualizar.', 409);
    const plano = planejarParcelasReceber(nota, { ...estado, items }, body.linhas);
    if (plano.erro) return erro(plano.erro, 422);
    if (body.acao === 'validar' || (!plano.alteradas.length && !plano.novas.length)) return Response.json({ success: true });

    const reservar = async (tipo, registro) => {
      const { token } = await reservarRegistroBaixa(db, tipo, registro.id, registro.updated_date);
      reservas.push({ tipo, id: registro.id, token });
    };
    try {
      await reservar('NotaFiscal', nota);
      const afetadas = items.filter(t => plano.alteradas.some(l => l.id === t.id));
      for (let i = 0; i < afetadas.length; i += 3) {
        const resultados = await Promise.allSettled(afetadas.slice(i, i + 3).map(t => reservar('TituloCobranca', t)));
        if (resultados.some(r => r.status === 'rejected')) return erro('Uma parcela está em processamento. Reabra o editor e tente novamente.', 409);
      }
    } catch (e) {
      if (/Registro alterado|Registro em processamento/.test(e.message)) return erro(e.message, 409);
      throw e;
    }
    const atual = await lerParcelasReceber(db, await db.NotaFiscal.get(nota.id));
    if (atual.versao !== estado.versao) return erro('As parcelas mudaram. Reabra o editor antes de salvar.', 409);
    let tentouCriar = false, tentouEditar = false, tentouNota = false;
    try {
      if (plano.alteradas.length) { tentouEditar = true; await db.TituloCobranca.bulkUpdate(plano.alteradas); }
      if (plano.novas.length) { tentouCriar = true; await db.TituloCobranca.bulkCreate(plano.novas); }
      const salvo = await lerParcelasReceber(db, nota);
      const mapa = new Map(salvo.items?.map(t => [t.id, t]));
      if (salvo.items?.length !== items.length + plano.novas.length || salvo.items.reduce((s, t) => s + Math.round(t.valor_titulo * 100), 0) !== Math.round(nota.valor_total * 100) || plano.alteradas.some(l => mapa.get(l.id)?.data_vencimento !== l.data_vencimento || mapa.get(l.id)?.valor_titulo !== l.valor_titulo)) throw new Error('O parcelamento gravado não corresponde ao planejado.');
      if (plano.proximo && plano.proximo !== nota.data_vencimento_proxima) { tentouNota = true; await db.NotaFiscal.update(nota.id, { data_vencimento_proxima: plano.proximo }); }
    } catch (e) {
      const reversao = await Promise.allSettled([
        tentouCriar && db.TituloCobranca.deleteMany({ nota_fiscal_id: nota.id, nosso_numero: { $in: plano.novas.map(t => t.nosso_numero) } }),
        tentouEditar && db.TituloCobranca.bulkUpdate(plano.anteriores),
        tentouNota && db.NotaFiscal.update(nota.id, { data_vencimento_proxima: nota.data_vencimento_proxima ?? null }),
      ]);
      if (reversao.some(r => r.status === 'rejected')) return erro('Não foi possível concluir nem restaurar todas as parcelas. Confira os títulos antes de tentar novamente.', 500);
      throw e;
    }
    return Response.json({ success: true });
  } catch (e) {
    console.error(e.message);
    return erro('Não foi possível concluir a operação de parcelas.', 500);
  } finally {
    const liberadas = await Promise.allSettled(reservas.map(r => liberarRegistroBaixa(db, r.tipo, r.id, r.token)));
    if (liberadas.some(r => r.status === 'rejected')) console.error('Falha ao liberar reserva de edição de parcelas.');
  }
}