import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { lerCompleto } from '../../shared/conciliacaoLeitura.ts';
import { registrosFluxoProjetado } from '../../shared/fluxoProjetadoRegistros.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), body = await req.json().catch(() => ({}));
    const interno = Boolean(secrets.get('NEXUS_HUB_TOKEN') && body.internal_token === secrets.get('NEXUS_HUB_TOKEN'));
    if (!interno) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const svc = base44.asServiceRole.entities;
    const [titulos, tributos, faturas, despesas, folhas, cartoes] = await Promise.all([
      lerCompleto(svc, 'TituloCobranca', {}), lerCompleto(svc, 'Tributo', {}), lerCompleto(svc, 'FaturaCartao', {}),
      lerCompleto(svc, 'DespesaOperacional', {}), lerCompleto(svc, 'FolhaPagamento', {}), lerCompleto(svc, 'ContaCartao', {}),
    ]);
    const validos = registrosFluxoProjetado({ titulos, tributos, faturas, despesas, folhas, cartoes });
    const entradas = validos.filter(r => r.tipo === 'entrada').reduce((s, r) => s + r.valor_previsto, 0);
    const saidas = validos.filter(r => r.tipo === 'saida').reduce((s, r) => s + r.valor_previsto, 0);
    const resumo = { success: true, entradas_previstas: +entradas.toFixed(2), saidas_previstas: +saidas.toFixed(2), saldo_projetado_movimentos: +(entradas - saidas).toFixed(2), faturas: validos.filter(r => r.origem_tipo === 'fatura').length, componentes_cartao_excluidos: despesas.filter(d => d.lancamento_cartao_id).length };
    // Prévia antes de toda escrita; pagamentos, documentos e valores históricos não são migrados.
    if (body.dry_run === true) return Response.json({ ...resumo, dry_run: true, somente_leitura: true, registros: validos.length, historico_preservado: true });
    const previstos = await lerCompleto(svc, 'FluxoCaixa', { status: 'previsto' });
    for (const p of previstos) if (p.origem_id) await svc.FluxoCaixa.delete(p.id);
    let criados = 0;
    for (let i = 0; i < validos.length; i += 100) { const lote = validos.slice(i, i + 100); await svc.FluxoCaixa.bulkCreate(lote); criados += lote.length; }
    return Response.json({ ...resumo, criados });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}