import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { auditarVinculos, carregarNaturezas } from '../../shared/vinculosNFBoletos.ts';

async function* paginas(entidade, filtro = {}) {
  let cursor;
  do {
    const pagina = await entidade.filter(filtro, { sort: 'id', limit: 250, ...(cursor ? { cursor } : {}) });
    yield pagina.items;
    if (pagina.has_more && (!pagina.next_cursor || pagina.next_cursor === cursor)) throw new Error('Paginação incompleta.');
    cursor = pagina.has_more ? pagina.next_cursor : undefined;
  } while (cursor);
}

async function coletar(entidade, filtro) {
  const out = [];
  for await (const itens of paginas(entidade, filtro)) out.push(...itens);
  return out;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Autenticação necessária.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });

    const db = base44.asServiceRole.entities;

    // Carrega todas as notas (NF, NFe, CI) — exclui apenas anuladas e espelho de CI
    const notas = await coletar(db.NotaFiscal, { status: { $ne: 'anulada' }, is_espelho_ci: { $ne: true } });
    // Carrega todos os boletos
    const boletos = await coletar(db.TituloCobranca, {});

    // Carrega naturezas de operação do XML (NFeRecebida)
    const numeros = [...new Set(notas.map(n => n.numero).filter(Boolean))];
    const naturezas = await carregarNaturezas(db, numeros);

    // Executa a auditoria
    const resultado = auditarVinculos(notas, boletos, naturezas);

    // Persiste apontamentos (opcional, controlado por body.persistir)
    const body = await req.json().catch(() => ({}));
    if (body.persistir !== false) {
      const agora = new Date().toISOString();
      const entity = db.ApontamentoRecebivel;
      // Inativa apontamentos anteriores não vistos nesta execução
      const inicio = new Date(Date.now() - 60000).toISOString();
      await entity.updateMany({ ativo: true, visto_em: { $lt: inicio } }, { $set: { ativo: false, inativado_em: agora } });

      // Upsert dos novos apontamentos
      const registros = resultado.achados.map(a => ({
        chave: a.chave,
        grupo: a.categoria,
        registro_id: a.nota?.id || '',
        referencia: `NF ${a.nota?.numero || ''}`,
        cliente: a.nota?.cliente || '',
        empresa: a.nota?.empresa || '',
        motivo: a.motivo || '',
        registrado: String(a.nota?.valor_total || 0),
        comparado: String(a.soma_parcelas || 0),
        cfop: a.nota?.cfop || '',
        natureza_operacao: a.nota?.natureza_operacao || '',
        nota_fiscal_id: a.nota?.id || '',
        titulo_id: a.boleto?.id || '',
        candidatos_json: a.candidatos ? JSON.stringify(a.candidatos).slice(0, 8000) : '',
        ativo: true,
        detectado_em: agora,
        visto_em: agora,
      }));
      for (let i = 0; i < registros.length; i += 250) {
        await entity.bulkCreate(registros.slice(i, i + 250));
      }
    }

    return Response.json(resultado);
  } catch (error) {
    console.error('Auditoria de vínculos:', error.message);
    return Response.json({ error: 'Não foi possível concluir a auditoria de vínculos.' }, { status: 500 });
  }
}