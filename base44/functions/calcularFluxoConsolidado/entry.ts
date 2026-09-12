import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { carregarDados } from '../../shared/fluxoConsolidado/carregar.ts';
import { calcularConsolidado } from '../../shared/fluxoConsolidado/motor.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const mes = /^\d{4}-\d{2}$/.test(body.mes || '') ? body.mes : hoje.slice(0, 7);
    const perimetro = ['grupo', 'NeuralTec', 'Liesch'].includes(body.perimetro) ? body.perimetro : 'grupo';

    const { dados, sourceStatus } = await carregarDados(base44);
    const resultado = calcularConsolidado({ dados, sourceStatus, mes, perimetro, hoje });
    return Response.json(resultado);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}