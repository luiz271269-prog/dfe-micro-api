import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { TIPOS, normalizarEvidencia, candidatosEvidencia, norm } from '../../shared/evidenciaFinanceira.ts';
import { direcaoBanco, recalcularRecebivel } from '../../shared/direcaoFinanceira.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json(), db = base44.asServiceRole.entities;
    if (body.validate_only) return Response.json({ success: true, tipos: TIPOS, normalizado: body.exemplo ? normalizarEvidencia(body.exemplo.tipo, body.exemplo.registro, {}) : null });
    if (body.acao === 'importar') {
      if (!TIPOS.includes(body.tipo) || !Array.isArray(body.registros) || !body.registros.length || body.registros.length > 200 || JSON.stringify(body.registros).length > 400000) return Response.json({ error: 'Tipo inválido ou lote maior que 200 registros.' }, { status: 400 });
      const registros = body.registros.map(r => normalizarEvidencia(body.tipo, r, { nome: String(body.arquivo_nome || '').slice(0,200), hash: String(body.arquivo_hash || '').slice(0,100) }));
      const unicos = [...new Map(registros.map(r => [r.chave,r])).values()];
      const resultado = await db.EvidenciaFinanceira.upsert(unicos, { key: 'chave' });
      return Response.json({ success: true, saved: resultado.created + resultado.updated, created: resultado.created, updated: resultado.updated });
    }
    if (!body.evidencia_id) return Response.json({ error: 'Selecione a evidência.' }, { status: 400 });
    const ev = await db.EvidenciaFinanceira.get(body.evidencia_id);
    if (!ev) return Response.json({ error: 'Evidência não encontrada.' }, { status: 404 });
    if (body.acao === 'candidatos') {
      const candidatos = await candidatosEvidencia(db, ev, body.entidade_tipo);
      let bancos = [];
      if (ev.tipo === 'boletos_liquidados' && ev.data) {
        const data = new Date(`${ev.data}T12:00:00Z`), inicio = new Date(data), fim = new Date(data);
        inicio.setUTCDate(data.getUTCDate()-3); fim.setUTCDate(data.getUTCDate()+3);
        const pagina = await db.LancamentoBancario.filter({ valor: { $gte: ev.valor }, data: { $gte: inicio.toISOString().slice(0,10), $lte: fim.toISOString().slice(0,10) }, status_conciliacao: { $nin: ['conciliado','ignorar'] }, categoria: { $nin: ['transferencia','interno','aporte','emprestimo','aplicacao','resgate'] } }, { limit: 50, sort: 'data' });
        bancos = pagina.items.map(b => ({ id:b.id, nome:b.descricao, valor:b.valor, data:b.data }));
      }
      return Response.json({ success: true, ...candidatos, bancos });
    }
    if (!['confirmar','rejeitar'].includes(body.acao)) return Response.json({ error: 'Ação inválida.' }, { status: 400 });
    const motivo = String(body.motivo || '').trim();
    if (motivo.length < 10 || motivo.length > 1000) return Response.json({ error: 'Registre uma justificativa entre 10 e 1000 caracteres.' }, { status: 400 });
    if (ev.estado === 'confirmada') {
      if (body.acao !== 'confirmar' || ev.entidade_id !== body.entidade_id || ev.lancamento_bancario_id !== (body.lancamento_bancario_id || '')) return Response.json({ error: 'Confirmação já registrada; o histórico não pode ser sobrescrito.' }, { status: 409 });
      return Response.json({ success:true, idempotente:true });
    }
    if (ev.estado === 'rejeitada') return Response.json({ error: 'Evidência já rejeitada. Histórico preservado.' }, { status: 409 });
    const auditoria = { motivo, confirmada_por:user.id, confirmada_em:new Date().toISOString() };
    if (body.acao === 'rejeitar') {
      await db.EvidenciaFinanceira.update(ev.id, { ...auditoria, estado:'rejeitada' });
      return Response.json({ success:true });
    }
    const candidatos = await candidatosEvidencia(db, ev, body.entidade_tipo);
    if (!candidatos.itens.some(c => c.id === body.entidade_id)) return Response.json({ error: 'O documento selecionado não corresponde à evidência.' }, { status: 422 });
    const alvo = await db[candidatos.tipo].get(body.entidade_id);
    if (ev.tipo === 'relatorio_nfs' && (Math.abs(Number(alvo.valor_total)-ev.valor)>0.01 || norm(alvo.cliente)!==norm(ev.contraparte))) return Response.json({ error: 'Nota com valor ou cliente divergente. Não será alterada.' }, { status:422 });
    let vinculoId = '';
    if (ev.tipo === 'boletos_liquidados') {
      if (!body.lancamento_bancario_id) return Response.json({ error: 'Selecione o crédito bancário para confirmar o recebimento.' }, { status:400 });
      const banco = await db.LancamentoBancario.get(body.lancamento_bancario_id);
      if (direcaoBanco(banco)!=='entrada' || !banco.data || Math.abs((new Date(banco.data)-new Date(ev.data))/86400000)>3) return Response.json({ error:'Crédito incompatível com a evidência de recebimento.' }, { status:422 });
      const identidade = norm(alvo.cliente)===norm(ev.contraparte);
      if (!identidade || (ev.referencia_nota && norm(alvo.seu_numero)!==norm(ev.referencia_nota))) return Response.json({ error:'Cliente ou referência da parcela diverge da evidência.' }, { status:422 });
      const anteriores = await db.VinculoExtrato.filter({ entidade_tipo:'TituloCobranca', entidade_id:alvo.id, lancamento_bancario_id:banco.id });
      if (anteriores.length) {
        if (anteriores.length!==1 || Math.abs(anteriores[0].valor_alocado-ev.valor)>0.01) return Response.json({ error:'Este crédito já possui outra alocação para o título.' }, { status:409 });
        vinculoId=anteriores[0].id;
        await recalcularRecebivel(db,'TituloCobranca',alvo.id);
      } else {
        const resposta = await base44.functions.invoke('vincularExtrato', { acao:'criar', entidade_tipo:'TituloCobranca', entidade_id:alvo.id, lancamento_bancario_id:banco.id, valor_alocado:ev.valor, tipo_vinculo:'recebimento_parcial', observacao:`Evidência ${ev.id}: ${motivo}` });
        if (!resposta.data?.success) return Response.json({ error:resposta.data?.error || 'Recebimento não confirmado.' }, { status:422 });
        vinculoId=resposta.data.vinculo.id;
      }
    }
    await db.EvidenciaFinanceira.update(ev.id, { ...auditoria, estado:'confirmada', entidade_tipo:candidatos.tipo, entidade_id:alvo.id, lancamento_bancario_id:ev.tipo==='boletos_liquidados' ? body.lancamento_bancario_id : '', vinculo_id:vinculoId });
    return Response.json({ success:true, mensagem:ev.tipo==='boletos_liquidados' ? 'Recebimento conciliado com o crédito bancário.' : 'Documento conferido. Nenhum pagamento ou obrigação criado.' });
  } catch (error) { return Response.json({ error:error.message }, { status:500 }); }
}