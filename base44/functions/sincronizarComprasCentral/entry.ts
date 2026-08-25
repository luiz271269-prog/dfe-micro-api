import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { CENTRAL_COMPRAS_API_BASE, getCentralComprasKey } from '../../shared/centralCompras.ts';

/**
 * sincronizarComprasCentral — puxa os Pedidos de Compra (PedidoCompra) do app
 * Central de Compras e os materializa como ItemCompra aqui (tipo_compra: estoque),
 * para entrarem no Contas a Pagar.
 *
 * Regras:
 *  - Dedup pela chave pedido_central_id (numero_pedido, ex: PC-2026-064).
 *  - Pedido não pago (pendente / pago_parcial) → cria ou atualiza ItemCompra.
 *  - Pedido pago → só atualiza se já existir localmente (marca como pago).
 *  - Vencimento: data_previsao_entrega, fallback data_pedido.
 *
 * Payload opcional: { dry_run: true } — só relata o que faria.
 */

function mapStatus(p) {
  if (p.status_pagamento === 'pago') return 'pago';
  if (p.status_pagamento === 'pago_parcial') return 'parcial';
  return 'pendente';
}

function resumoItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) return null;
  const primeiro = (itens[0].descricao || '').slice(0, 120);
  return itens.length > 1 ? `${primeiro} (+${itens.length - 1} itens)` : primeiro;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const dryRun = payload.dry_run === true;

    // 1. Buscar pedidos na Central de Compras
    const res = await fetch(`${CENTRAL_COMPRAS_API_BASE}/PedidoCompra?limit=500`, {
      headers: { api_key: getCentralComprasKey() },
    });
    if (!res.ok) {
      return Response.json({ ok: false, motivo: `Central de Compras respondeu HTTP ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const pedidos = Array.isArray(data) ? data : (data.results || []);

    // 2. Indexar ItemCompra locais já sincronizados
    const locais = await base44.entities.ItemCompra.list('-data_emissao', 2000);
    const porPedido = new Map(locais.filter(c => c.pedido_central_id).map(c => [c.pedido_central_id, c]));

    let criados = 0, atualizados = 0, ignorados = 0;
    const acoes = [];

    for (const p of pedidos) {
      if (!p.numero_pedido || !(p.valor_total > 0)) { ignorados++; continue; }
      const statusLocal = mapStatus(p);
      const existente = porPedido.get(p.numero_pedido);

      const dados = {
        fornecedor: p.fornecedor_nome || 'Fornecedor',
        pedido_central_id: p.numero_pedido,
        numero_nota: p.nota_fiscal_numero || undefined,
        data_emissao: p.data_pedido,
        data_vencimento: p.data_previsao_entrega || p.data_pedido,
        descricao_produto: resumoItens(p.itens) || `Pedido ${p.numero_pedido}`,
        categoria_produto: 'outro',
        origem_compra: 'empresa',
        tipo_compra: 'estoque',
        quantidade: Array.isArray(p.itens) ? p.itens.reduce((a, i) => a + (i.quantidade || 0), 0) : 1,
        valor_total: p.valor_total,
        valor_pago: p.valor_pago || 0,
        status_pagamento: statusLocal,
      };

      if (existente) {
        const mudou = existente.status_pagamento !== statusLocal
          || Math.abs((existente.valor_total || 0) - p.valor_total) > 0.01
          || Math.abs((existente.valor_pago || 0) - (p.valor_pago || 0)) > 0.01
          || existente.data_vencimento !== dados.data_vencimento;
        if (!mudou) { ignorados++; continue; }
        // Não sobrescrever baixa local: se já foi pago aqui, só sincroniza valores
        if (existente.status_pagamento === 'pago' && statusLocal !== 'pago') {
          ignorados++; continue;
        }
        if (!dryRun) {
          await base44.entities.ItemCompra.update(existente.id, {
            status_pagamento: statusLocal,
            valor_total: p.valor_total,
            valor_pago: p.valor_pago || 0,
            data_vencimento: dados.data_vencimento,
            numero_nota: dados.numero_nota,
          });
        }
        atualizados++;
        acoes.push({ pedido: p.numero_pedido, acao: 'atualizado', status: statusLocal });
      } else {
        // Pedido já pago e nunca importado — não cria conta a pagar retroativa
        if (statusLocal === 'pago') { ignorados++; continue; }
        if (!dryRun) {
          await base44.entities.ItemCompra.create(dados);
        }
        criados++;
        acoes.push({ pedido: p.numero_pedido, acao: 'criado', status: statusLocal, valor: p.valor_total, fornecedor: dados.fornecedor });
      }
    }

    return Response.json({
      ok: true,
      dry_run: dryRun,
      total_pedidos: pedidos.length,
      criados, atualizados, ignorados,
      acoes: acoes.slice(0, 100),
    });
  } catch (error) {
    console.error('sincronizarComprasCentral erro:', error);
    return Response.json({ ok: false, motivo: error.message }, { status: 500 });
  }
}