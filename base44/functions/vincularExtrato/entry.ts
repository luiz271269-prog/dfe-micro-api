import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Função universal de vínculo extrato ↔ qualquer entidade de controle.
 *
 * Ações:
 *  - criar  : cria VinculoExtrato + atualiza cache do LancamentoBancario + status da obrigação se integral
 *  - remover: apaga VinculoExtrato por id + recalcula cache
 *  - recalcular: só recalcula status_conciliacao/vinculos_count/valor_conciliado de um lançamento
 *
 * Payload:
 *  { acao: "criar", lancamento_bancario_id, entidade_tipo, entidade_id, valor_alocado, tipo_vinculo?, observacao? }
 *  { acao: "remover", vinculo_id }
 *  { acao: "recalcular", lancamento_bancario_id }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const svc = base44.asServiceRole.entities;

    async function recalcularCache(lancId) {
      if (!lancId) return null;
      const [lanc] = await svc.LancamentoBancario.filter({ id: lancId });
      if (!lanc) return null;
      const vinculos = await svc.VinculoExtrato.filter({ lancamento_bancario_id: lancId });
      const valorConc = vinculos.reduce((s, v) => s + (v.valor_alocado || 0), 0);
      const valorAbs = Math.abs(lanc.valor || 0);
      let status = 'nao_conciliado';
      if (vinculos.length > 0) {
        status = valorConc >= valorAbs - 0.5 ? 'conciliado' : 'parcial';
      }
      await svc.LancamentoBancario.update(lancId, {
        status_conciliacao: status,
        vinculos_count: vinculos.length,
        valor_conciliado: valorConc,
      });
      return { status, vinculos_count: vinculos.length, valor_conciliado: valorConc };
    }

    if (body.acao === 'criar') {
      const { lancamento_bancario_id, entidade_tipo, entidade_id, valor_alocado, tipo_vinculo, observacao } = body;
      if (!lancamento_bancario_id || !entidade_tipo || !entidade_id || valor_alocado == null) {
        return Response.json({ error: 'Faltam parâmetros: lancamento_bancario_id, entidade_tipo, entidade_id, valor_alocado' }, { status: 400 });
      }

      // Evitar duplicata
      const existente = await svc.VinculoExtrato.filter({
        lancamento_bancario_id, entidade_tipo, entidade_id,
      });
      if (existente?.length > 0) {
        return Response.json({ error: 'Vínculo já existe', vinculo_id: existente[0].id }, { status: 409 });
      }

      const novo = await svc.VinculoExtrato.create({
        lancamento_bancario_id,
        entidade_tipo,
        entidade_id,
        valor_alocado: Math.abs(valor_alocado),
        tipo_vinculo: tipo_vinculo || 'pagamento_integral',
        conciliado_por: 'manual',
        confianca: 100,
        observacao: observacao || '',
      });

      const cache = await recalcularCache(lancamento_bancario_id);
      return Response.json({ success: true, vinculo: novo, cache });
    }

    if (body.acao === 'remover') {
      const { vinculo_id } = body;
      if (!vinculo_id) return Response.json({ error: 'Falta vinculo_id' }, { status: 400 });
      const [v] = await svc.VinculoExtrato.filter({ id: vinculo_id });
      if (!v) return Response.json({ error: 'Vínculo não encontrado' }, { status: 404 });
      await svc.VinculoExtrato.delete(vinculo_id);
      const cache = await recalcularCache(v.lancamento_bancario_id);
      return Response.json({ success: true, cache });
    }

    if (body.acao === 'recalcular') {
      const cache = await recalcularCache(body.lancamento_bancario_id);
      return Response.json({ success: true, cache });
    }

    return Response.json({ error: 'acao inválida — use criar | remover | recalcular' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});