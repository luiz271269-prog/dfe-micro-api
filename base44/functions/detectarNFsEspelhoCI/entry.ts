import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Detecta NFs que são "espelho fiscal" de um CI já existente.
// Critério: mesmo cliente + mesmo valor_total (tolerância R$ 1,00) + emissão dentro de ±60 dias do CI.
// Marca a NF com is_espelho_ci=true e ci_referencia=<numero do CI>, para que ela seja
// excluída dos totalizadores de faturamento/a-receber (evita dupla contagem).

function normalizarCliente(s) {
  return (s || '').toUpperCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function diffDias(d1, d2) {
  const a = new Date(d1).getTime();
  const b = new Date(d2).getTime();
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;
    const todas = await svc.NotaFiscal.list('-data_emissao', 10000);

    const cis = todas.filter(n => n.tipo === 'CI');
    const nfs = todas.filter(n => n.tipo === 'NF' || n.tipo === 'NFe');

    const TOL_VALOR = 1.00;
    const TOL_DIAS = 60;

    let marcadas = 0;
    let desmarcadas = 0;
    const detalhes = [];

    for (const nf of nfs) {
      const clienteNF = normalizarCliente(nf.cliente);
      const match = cis.find(ci => {
        if (normalizarCliente(ci.cliente) !== clienteNF) return false;
        if (Math.abs((ci.valor_total || 0) - (nf.valor_total || 0)) > TOL_VALOR) return false;
        if (!ci.data_emissao || !nf.data_emissao) return false;
        if (diffDias(ci.data_emissao, nf.data_emissao) > TOL_DIAS) return false;
        return true;
      });

      if (match) {
        if (!nf.is_espelho_ci || nf.ci_referencia !== match.numero) {
          await svc.NotaFiscal.update(nf.id, {
            is_espelho_ci: true,
            ci_referencia: match.numero,
          });
          marcadas++;
          detalhes.push({
            nf_numero: nf.numero,
            ci_numero: match.numero,
            cliente: nf.cliente,
            valor: nf.valor_total,
          });
        }
      } else if (nf.is_espelho_ci) {
        // Não tem mais CI correspondente — desmarca
        await svc.NotaFiscal.update(nf.id, {
          is_espelho_ci: false,
          ci_referencia: null,
        });
        desmarcadas++;
      }
    }

    return Response.json({
      success: true,
      marcadas,
      desmarcadas,
      total_cis: cis.length,
      total_nfs: nfs.length,
      detalhes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});