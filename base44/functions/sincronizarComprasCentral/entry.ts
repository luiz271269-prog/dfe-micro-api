import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { consultarPedidosCentral } from '../../shared/centralComprasConsulta.ts';

// Compatibilidade com chamadas antigas: somente consulta, nunca importa ou atualiza registros.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const tokenInterno = secrets.get('NEXUS_HUB_TOKEN');
    const chamadaInterna = Boolean(tokenInterno && payload.internal_token === tokenInterno);
    if (!chamadaInterna) {
      const user = await base44.auth.me().catch((e) => e.status === 401 ? null : Promise.reject(e));
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin required' }, { status: 403 });
    }
    const resultado = await consultarPedidosCentral();
    if (!resultado.ok) return Response.json({ ok: false, motivo: resultado.motivo, status: resultado.status, diagnostico: resultado.diagnostico }, { status: 502 });
    return Response.json({
      ok: true, modo: 'somente_leitura', total_pedidos: resultado.data.length,
      criados: 0, atualizados: 0, acoes: [],
      mensagem: 'Consulta online concluída. Nenhum registro foi importado ou alterado.',
    });
  } catch (error) {
    return Response.json({ ok: false, motivo: error.message }, { status: 500 });
  }
}