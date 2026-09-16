import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { fetchCentralCompras, normalizarFormaPagamento } from '../../shared/centralCompras.ts';

/**
 * sincronizarComprasCentral — puxa os Pedidos de Compra (PedidoCompra) do app
 * Central de Compras e os materializa como ItemCompra aqui (tipo_compra: estoque),
 * para entrarem no Contas a Pagar.
 *
 * Regras:
 *  - Dedup pela chave pedido_central_id (numero_pedido, ex: PC-2026-064).
 *  - Pedido não pago (pendente / pago_parcial) → cria ou atualiza ItemCompra.
 *  - Pedido pago também é importado: custo por competência, sem reabrir conta a pagar.
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
    const payload = await req.json().catch(() => ({}));
    const tokenInterno = secrets.get('NEXUS_HUB_TOKEN');
    const chamadaInterna = Boolean(tokenInterno && payload.internal_token === tokenInterno);
    if (!chamadaInterna) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });
    }
    const dryRun = payload.dry_run === true;
    const db = chamadaInterna ? base44.asServiceRole.entities : base44.entities;

    // 1. Buscar pedidos na Central de Compras
    const resultado = await fetchCentralCompras('PedidoCompra', 'limit=500');
    if (!resultado.ok) {
      return Response.json({ ok: false, motivo: `Central de Compras respondeu HTTP ${resultado.status}; nenhuma compra foi importada.` }, { status: 502 });
    }
    const pedidos = resultado.data;

    // 2. Indexar ItemCompra locais já sincronizados
    const locais = await db.ItemCompra.list('-data_emissao', 2000);
    const porPedido = new Map(locais.filter(c => c.pedido_central_id).map(c => [c.pedido_central_id, c]));

    let criados = 0, atualizados = 0, ignorados = 0;
    const acoes = [];
    const processados = new Set();

    for (const p of pedidos) {
      if (processados.has(p.numero_pedido)) { ignorados++; continue; }
      processados.add(p.numero_pedido);
      if (!p.numero_pedido || !(p.valor_total > 0) || !p.data_pedido || ['cancelado', 'cancelada'].includes(p.status)) { ignorados++; continue; }
      const statusLocal = mapStatus(p);
      const formaPagamento = normalizarFormaPagamento(p.condicao_pagamento || p.forma_pagamento);
      const existente = porPedido.get(p.numero_pedido);

      const dados = {
        fornecedor: p.fornecedor_nome || p.fornecedor || 'Fornecedor',
        pedido_central_id: p.numero_pedido,
        pedido_central_internal_id: p.id || existente?.pedido_central_internal_id || undefined,
        numero_nota: p.nota_fiscal_numero || undefined,
        data_emissao: p.data_pedido,
        data_vencimento: p.data_previsao_entrega || p.data_pedido,
        descricao_produto: resumoItens(p.itens) || `Pedido ${p.numero_pedido}`,
        categoria_produto: 'outro',
        origem_compra: 'empresa',
        tipo_compra: 'estoque',
        quantidade: Array.isArray(p.itens) ? p.itens.reduce((a, i) => a + (i.quantidade || 0), 0) : 1,
        valor_total: p.valor_total,
        valor_pago: statusLocal === 'pago' ? (p.valor_pago || p.valor_total) : (p.valor_pago || 0),
        status_pagamento: statusLocal,
        forma_pagamento: formaPagamento !== 'nao_definida' ? formaPagamento : (existente?.forma_pagamento || 'nao_definida'),
      };

      if (existente) {
        // Preserva liquidações comprovadas localmente sem impedir a atualização do custo.
        if (existente.status_pagamento === 'pago' && statusLocal !== 'pago') {
          dados.status_pagamento = 'pago';
          dados.valor_pago = existente.valor_pago;
        }
        const mudou = Object.entries(dados).some(([key, value]) => value !== undefined && existente[key] !== value);
        if (!mudou) { ignorados++; continue; }
        if (!dryRun) await db.ItemCompra.update(existente.id, dados);
        atualizados++;
        acoes.push({ pedido: p.numero_pedido, acao: 'atualizado', status: dados.status_pagamento });
      } else {
        // Não soma novamente uma compra já registrada pela mesma NF e fornecedor.
        const mesmaNota = dados.numero_nota && locais.some(c => c.numero_nota === dados.numero_nota && String(c.fornecedor).trim().toLowerCase() === dados.fornecedor.trim().toLowerCase());
        if (mesmaNota) { ignorados++; acoes.push({ pedido: p.numero_pedido, acao: 'revisar_vinculo', motivo: 'NF e fornecedor já registrados localmente' }); continue; }
        if (!dryRun) await db.ItemCompra.create(dados);
        porPedido.set(p.numero_pedido, dados);
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