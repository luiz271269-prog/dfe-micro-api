import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Regras determinísticas para identificar débitos de Pessoal (Pró-labore + Folha)
const PADROES_PESSOAL = [
  /pro[\s-]?labore/i,
  /prolabore/i,
  /pró[\s-]?labore/i,
  /retirada\s+s[óo]cio/i,
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

function deveSerPessoal(descricao) {
  if (!descricao) return false;
  return PADROES_PESSOAL.some(rx => rx.test(descricao));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Carrega débitos (valor < 0) que NÃO estão classificados como pessoal
    const todos = await base44.entities.LancamentoBancario.list('-data', 5000);
    const candidatos = todos.filter(l =>
      (l.valor || 0) < 0 &&
      l.categoria !== 'pessoal' &&
      deveSerPessoal(l.descricao)
    );

    const detalhes = candidatos.map(l => ({
      id: l.id,
      data: l.data,
      descricao: l.descricao,
      valor: l.valor,
      categoria_atual: l.categoria,
      nova_categoria: 'pessoal',
    }));

    if (dryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        total_encontrados: candidatos.length,
        detalhes,
      });
    }

    let atualizados = 0;
    for (const c of candidatos) {
      await base44.entities.LancamentoBancario.update(c.id, { categoria: 'pessoal' });
      atualizados++;
    }

    return Response.json({
      success: true,
      total_reclassificados: atualizados,
      detalhes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});