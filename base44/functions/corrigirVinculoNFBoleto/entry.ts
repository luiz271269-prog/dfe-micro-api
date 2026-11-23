import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Autenticação necessária.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });

    const { titulo_id, nota_fiscal_id_atual, nova_nota_fiscal_id, justificativa } = await req.json().catch(() => ({}));
    if (!titulo_id) return Response.json({ error: 'titulo_id é obrigatório.' }, { status: 400 });
    if (!nova_nota_fiscal_id) return Response.json({ error: 'nova_nota_fiscal_id é obrigatório.' }, { status: 400 });
    if (!justificativa || !justificativa.trim()) return Response.json({ error: 'justificativa é obrigatória.' }, { status: 400 });

    const db = base44.asServiceRole.entities;

    // Carrega o boleto
    const boleto = await db.TituloCobranca.get(titulo_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!boleto) return Response.json({ error: 'Boleto não encontrado.' }, { status: 404 });

    // Valida que o vínculo atual confere com o informado
    if (nota_fiscal_id_atual && boleto.nota_fiscal_id !== nota_fiscal_id_atual) {
      return Response.json({ error: 'Vínculo atual não confere com o informado. Atualize a auditoria antes de corrigir.' }, { status: 409 });
    }

    // Carrega a NF de destino
    const novaNF = await db.NotaFiscal.get(nova_nota_fiscal_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!novaNF) return Response.json({ error: 'Nota fiscal de destino não encontrada.' }, { status: 404 });
    if (novaNF.tipo !== 'NF' || novaNF.is_espelho_ci) {
      return Response.json({ error: 'Nota fiscal de destino não é uma NF de venda válida.' }, { status: 400 });
    }

    // Não altera valores, pagamentos ou liquidações — apenas o vínculo
    const antes = { nota_fiscal_id: boleto.nota_fiscal_id, nosso_numero: boleto.nosso_numero, seu_numero: boleto.seu_numero, valor_titulo: boleto.valor_titulo, valor_pago: boleto.valor_pago, status: boleto.status, lancamento_bancario_id: boleto.lancamento_bancario_id };

    await db.TituloCobranca.update(titulo_id, { nota_fiscal_id: nova_nota_fiscal_id });

    const depois = { nota_fiscal_id: nova_nota_fiscal_id };

    // Registra a decisão para auditoria
    await db.DecisaoRevisao.create({
      chave: `vinculo_nf_boleto:${titulo_id}`,
      detector: 'auditoria_vinculos_nf_boletos',
      modulo: 'cobrancas',
      entidade_tipo: 'TituloCobranca',
      entidade_id: titulo_id,
      estado: 'aplicada',
      procedimento_rotulo: 'Correção de vínculo NF × boleto',
      alternativa: justificativa.trim(),
      antes_json: JSON.stringify(antes).slice(0, 4000),
      depois_json: JSON.stringify(depois).slice(0, 4000),
      decidido_por: user.id,
      decidido_em: new Date().toISOString(),
    });

    return Response.json({ success: true, titulo_id, nota_fiscal_id: nova_nota_fiscal_id, antes, depois });
  } catch (error) {
    console.error('Correção de vínculo:', error.message);
    return Response.json({ error: 'Não foi possível aplicar a correção do vínculo.' }, { status: 500 });
  }
}