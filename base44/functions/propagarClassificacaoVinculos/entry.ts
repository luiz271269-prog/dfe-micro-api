import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Saneamento: preenche origem_compra / tipo_compra nos VinculoExtrato existentes,
// herdando a classificação unificada da entidade de origem.
// Quando a origem também não tem classificação, infere um tipo_compra padrão pelo tipo de entidade.

const PADRAO_POR_TIPO: Record<string, string> = {
  Tributo: 'impostos',
  FolhaPagamento: 'folha',
  DespesaOperacional: 'despesas',
  ObraReforma: 'obras',
  ItemCompra: 'estoque',
  FaturaCartao: 'financeiro',
};

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
    const dryRun = body?.dry_run === true;

    const vinculos = await svc.VinculoExtrato.list('-created_date', 5000);
    const pendentes = vinculos.filter((v: any) => !v.origem_compra || !v.tipo_compra);

    // Carrega as origens necessárias, agrupadas por tipo
    const tipos = [...new Set(pendentes.map((v: any) => v.entidade_tipo))];
    const cache: Record<string, Record<string, any>> = {};
    for (const tipo of tipos) {
      if (!svc[tipo]) continue;
      const registros = await svc[tipo].list('-created_date', 5000).catch(() => []);
      cache[tipo] = Object.fromEntries(registros.map((r: any) => [r.id, r]));
    }

    const updates: any[] = [];
    const semOrigem: string[] = [];
    for (const v of pendentes) {
      const origem = cache[v.entidade_tipo]?.[v.entidade_id];
      if (!origem) { semOrigem.push(`${v.entidade_tipo}:${v.entidade_id}`); continue; }
      const origem_compra = v.origem_compra || origem.origem_compra || 'empresa';
      const tipo_compra = v.tipo_compra || origem.tipo_compra || PADRAO_POR_TIPO[v.entidade_tipo] || 'outro';
      if (origem_compra === v.origem_compra && tipo_compra === v.tipo_compra) continue;
      updates.push({ id: v.id, origem_compra, tipo_compra });
    }

    if (!dryRun) {
      for (let i = 0; i < updates.length; i += 100) {
        await svc.VinculoExtrato.bulkUpdate(updates.slice(i, i + 100));
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      total_vinculos: vinculos.length,
      pendentes: pendentes.length,
      atualizados: updates.length,
      orfaos_sem_origem: semOrigem.length,
      exemplos_orfaos: semOrigem.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});