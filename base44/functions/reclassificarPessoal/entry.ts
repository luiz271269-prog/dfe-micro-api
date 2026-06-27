import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Padrões para PRÓ-LABORE (categoria separada)
const PADROES_PRO_LABORE = [
  /pro[\s-]?labore/i,
  /prolabore/i,
  /pró[\s-]?labore/i,
  /retirada\s+s[óo]cio/i,
  /distrib(\.|uicao|uição)?\s+lucros?/i,
  /dividendos?/i,
];

// Padrões para FOLHA DE PAGAMENTO (categoria pessoal)
const PADROES_FOLHA = [
  /folha\s+(de\s+)?pag/i,
  /folha\s+pgto/i,
  /pgto\s+folha/i,
  /pagto\s+folha/i,
  /sal[áa]rio/i,
  /pagto\s+funcion[áa]rio/i,
  /pgto\s+func/i,
  /adiantamento\s+salarial/i,
  /vale\s+funcion[áa]rio/i,
  /comiss[ãa]o\s+func/i,
];

function classificar(descricao) {
  if (!descricao) return null;
  if (PADROES_PRO_LABORE.some(rx => rx.test(descricao))) return 'pro_labore';
  if (PADROES_FOLHA.some(rx => rx.test(descricao))) return 'pessoal';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const todos = await base44.entities.LancamentoBancario.list('-data', 5000);
    const candidatos = todos
      .filter(l => (l.valor || 0) < 0)
      .map(l => ({ l, sugerida: classificar(l.descricao) }))
      .filter(x => x.sugerida && x.sugerida !== x.l.categoria);

    const detalhes = candidatos.map(({ l, sugerida }) => ({
      id: l.id,
      data: l.data,
      descricao: l.descricao,
      valor: l.valor,
      categoria_atual: l.categoria,
      nova_categoria: sugerida,
    }));

    if (dryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        total_encontrados: candidatos.length,
        folha: candidatos.filter(c => c.sugerida === 'pessoal').length,
        pro_labore: candidatos.filter(c => c.sugerida === 'pro_labore').length,
        detalhes,
      });
    }

    let atualizados = 0;
    for (const { l, sugerida } of candidatos) {
      await base44.entities.LancamentoBancario.update(l.id, { categoria: sugerida });
      atualizados++;
    }

    return Response.json({
      success: true,
      total_reclassificados: atualizados,
      folha: candidatos.filter(c => c.sugerida === 'pessoal').length,
      pro_labore: candidatos.filter(c => c.sugerida === 'pro_labore').length,
      detalhes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});