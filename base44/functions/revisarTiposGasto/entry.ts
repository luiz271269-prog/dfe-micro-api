import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { construirMemoria, classificarRegistro, validarCombinacao, resolverCadastro } from '../../shared/classificacaoFinanceira.ts';

const entidades = ['LancamentoBancario', 'LancamentoCartao', 'FaturaCartao', 'DespesaOperacional', 'Tributo', 'FolhaPagamento', 'ItemCompra', 'ObraReforma', 'RegraRecorrente'];
const campos = ['origem_compra', 'tipo_compra', 'categoria'];

async function listarTudo(db, entidade) {
  const todos = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const pagina = await db[entidade].list('-created_date', 500, offset);
    todos.push(...pagina);
    if (pagina.length < 500) break;
  }
  return todos;
}

async function atualizarVinculos(base44, entidade, id, classificacao) {
  const db = base44.entities;
  const query = entidade === 'LancamentoBancario' ? { lancamento_bancario_id: id } : { entidade_tipo: entidade, entidade_id: id };
  const links = await db.VinculoExtrato.filter(query, '-created_date', 501);
  if (links.length > 500) throw new Error('Mais de 500 vínculos; revise este registro separadamente.');
  const herdavel = {};
  if (classificacao.origem_compra !== undefined) herdavel.origem_compra = classificacao.origem_compra;
  if (classificacao.tipo_compra !== undefined) herdavel.tipo_compra = classificacao.tipo_compra;
  if (links.length && Object.keys(herdavel).length) await db.VinculoExtrato.bulkUpdate(links.map(v => ({ id: v.id, ...herdavel })));
  return links.length;
}

async function propagarCartao(base44, entidade, id) {
  if (entidade !== 'LancamentoCartao') return 0;
  const resposta = await base44.functions.invoke('propagarClassificacaoVinculos', { lancamento_cartao_id: id });
  return resposta.data?.filhos_atualizados || 0;
}

async function auditar(db, registros) {
  for (let i = 0; i < registros.length; i += 500) await db.AuditoriaClassificacao.bulkCreate(registros.slice(i, i + 500));
}

function persistivel(entidade, classificacao) {
  const dados = { origem_compra: classificacao.origem_compra, tipo_compra: classificacao.tipo_compra };
  if (['LancamentoBancario', 'LancamentoCartao', 'DespesaOperacional'].includes(entidade)) dados.categoria = classificacao.categoria;
  return dados;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const payload = await req.json();
    const { action, entidade, id } = payload;
    const db = base44.entities;
    const cadastro = await db.CadastroClassificacao.list('ordem', 200);
    const permitidos = resolverCadastro(cadastro, user.role);

    if (action === 'migrar_cadastro') {
      if (user.role !== 'admin') return Response.json({ error: 'Apenas administradores podem migrar o cadastro.' }, { status: 403 });
      const nomes = ['LancamentoBancario', 'LancamentoCartao', 'DespesaOperacional', 'ItemCompra', 'ObraReforma', 'FolhaPagamento', 'VinculoExtrato'];
      const execucaoId = `migracao-cadastro-${Date.now()}`;
      const auditoria = [];
      for (const nome of nomes) {
        for (let lote = 0; lote < 20; lote++) {
          const registros = await db[nome].filter({ origem_compra: 'pessoal' }, '-created_date', 500);
          if (!registros.length) break;
          await db[nome].bulkUpdate(registros.map(registro => ({ id: registro.id, origem_compra: 'pro_labore', tipo_compra: 'pro_labore' })));
          auditoria.push(...registros.map(registro => ({ execucao_id: execucaoId, entidade_tipo: nome, entidade_id: registro.id, origem_alteracao: 'automatica', confianca: 100, motivos: ['migração do cadastro mestre: pessoal para Pró-labore'], antes_json: JSON.stringify({ origem_compra: 'pessoal' }), depois_json: JSON.stringify({ origem_compra: 'pro_labore', tipo_compra: 'pro_labore' }) })));
        }
      }
      if (auditoria.length) await auditar(db, auditoria);
      return Response.json({ success: true, execucao_id: execucaoId, migrados: auditoria.length });
    }

    if (action === 'aplicar_automatico') {
      if (user.role !== 'admin') return Response.json({ error: 'Apenas administradores podem reclassificar o histórico.' }, { status: 403 });
      const dryRun = payload.dry_run !== false;
      const dados = {};
      for (const nome of entidades.filter(n => n !== 'RegraRecorrente')) dados[nome] = await listarTudo(db, nome);
      const memoria = construirMemoria(dados, cadastro, user.role);
      const execucaoId = `classificacao-${Date.now()}`;
      const resumo = {};
      const amostra = [];
      const auditoria = [];
      const classificacoesFonte = new Map();

      for (const [nome, registros] of Object.entries(dados)) {
        const avaliados = registros.map(registro => ({ registro, resultado: classificarRegistro(nome, registro, memoria, cadastro, user.role) }));
        avaliados.forEach(x => classificacoesFonte.set(`${nome}|${x.registro.id}`, x.resultado.depois));
        const alteracoes = avaliados.filter(x => x.resultado.mudou);
        resumo[nome] = { analisados: registros.length, alterados: alteracoes.length };
        amostra.push(...alteracoes.slice(0, 5).map(x => ({ entidade: nome, id: x.registro.id, ...x.resultado })));
        if (!dryRun && alteracoes.length) {
          for (let i = 0; i < alteracoes.length; i += 500) await db[nome].bulkUpdate(alteracoes.slice(i, i + 500).map(x => ({ id: x.registro.id, ...persistivel(nome, x.resultado.depois) })));
          auditoria.push(...alteracoes.map(x => ({ execucao_id: execucaoId, entidade_tipo: nome, entidade_id: x.registro.id, origem_alteracao: 'automatica', confianca: x.resultado.confianca, motivos: x.resultado.motivos, antes_json: JSON.stringify(x.resultado.antes), depois_json: JSON.stringify(x.resultado.depois) })));
        }
      }
      if (!dryRun) {
        const vinculos = await listarTudo(db, 'VinculoExtrato');
        const alterarVinculos = vinculos.map(v => ({ vinculo: v, fonte: classificacoesFonte.get(`${v.entidade_tipo}|${v.entidade_id}`) })).filter(x => x.fonte && (x.vinculo.origem_compra !== x.fonte.origem_compra || x.vinculo.tipo_compra !== x.fonte.tipo_compra));
        resumo.VinculoExtrato = { analisados: vinculos.length, alterados: alterarVinculos.length };
        for (let i = 0; i < alterarVinculos.length; i += 500) await db.VinculoExtrato.bulkUpdate(alterarVinculos.slice(i, i + 500).map(x => ({ id: x.vinculo.id, origem_compra: x.fonte.origem_compra, tipo_compra: x.fonte.tipo_compra })));
        auditoria.push(...alterarVinculos.map(x => ({ execucao_id: execucaoId, entidade_tipo: 'VinculoExtrato', entidade_id: x.vinculo.id, origem_alteracao: 'automatica', confianca: 100, motivos: ['classificação herdada da entidade de origem'], antes_json: JSON.stringify({ origem_compra: x.vinculo.origem_compra || '', tipo_compra: x.vinculo.tipo_compra || '' }), depois_json: JSON.stringify({ origem_compra: x.fonte.origem_compra, tipo_compra: x.fonte.tipo_compra }) })));
      }
      if (!dryRun && auditoria.length) await auditar(db, auditoria);
      return Response.json({ success: true, dry_run: dryRun, execucao_id: execucaoId, resumo, total_alterado: Object.values(resumo).reduce((s, x) => s + x.alterados, 0), amostra: amostra.slice(0, 30) });
    }

    if (!entidades.includes(entidade)) return Response.json({ error: 'Módulo inválido' }, { status: 400 });
    if (action === 'listar') {
      const offset = Number(payload.offset || 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) return Response.json({ error: 'Página inválida' }, { status: 400 });
      const rows = await db[entidade].list('-created_date', 200, offset);
      const itens = rows.map(r => ({ registro: r, resultado: classificarRegistro(entidade, r, new Map(), cadastro, user.role) })).filter(x => x.resultado.mudou).slice(0, 50).map(x => ({ id: x.registro.id, tipo_compra: x.registro.tipo_compra || '', descricao: x.registro.descricao || x.registro.descricao_produto || x.registro.estabelecimento || x.registro.funcionario_nome || x.registro.tipo || 'Sem descrição', data: x.registro.data || x.registro.data_lancamento || x.registro.data_emissao || x.registro.data_vencimento || x.registro.competencia || '', valor: x.registro.valor ?? x.registro.valor_total ?? x.registro.valor_original ?? x.registro.salario_liquido ?? 0, motivos: x.resultado.motivos }));
      return Response.json({ itens, has_more: rows.length === 200, next_offset: offset + 200 });
    }

    const registro = await db[entidade].get(id);
    if (!registro) return Response.json({ error: 'Registro não encontrado' }, { status: 404 });
    const proposto = { ...registro };
    if (action === 'salvar') {
      if (!permitidos.tipos.includes(payload.tipo)) return Response.json({ error: 'Natureza econômica inativa ou não permitida para este perfil.' }, { status: 400 });
      proposto.tipo_compra = payload.tipo;
    } else if (action === 'salvar_eixo') {
      if (!campos.includes(payload.campo) || typeof payload.valor !== 'string') return Response.json({ error: 'Classificação inválida.' }, { status: 400 });
      if (payload.campo === 'origem_compra' && !permitidos.origens.includes(payload.valor)) return Response.json({ error: 'Centro de custo inativo ou não permitido.' }, { status: 400 });
      if (payload.campo === 'tipo_compra' && !permitidos.tipos.includes(payload.valor)) return Response.json({ error: 'Natureza econômica inativa ou não permitida.' }, { status: 400 });
      if (payload.campo === 'categoria' && permitidos.categorias.length && !permitidos.categorias.includes(payload.valor)) return Response.json({ error: 'Conta analítica inativa ou não permitida.' }, { status: 400 });
      proposto[payload.campo] = payload.valor;
    } else return Response.json({ error: 'Ação inválida.' }, { status: 400 });

    const depois = validarCombinacao(entidade, proposto, cadastro, user.role).normalizado;
    await db[entidade].update(id, persistivel(entidade, depois));
    const vinculosAtualizados = await atualizarVinculos(base44, entidade, id, depois);
    const filhosAtualizados = await propagarCartao(base44, entidade, id);
    await db.AuditoriaClassificacao.create({ execucao_id: `manual-${Date.now()}`, entidade_tipo: entidade, entidade_id: id, origem_alteracao: 'manual', confianca: 100, motivos: [`alteração manual de ${action === 'salvar' ? 'tipo_compra' : payload.campo}`], antes_json: JSON.stringify({ origem_compra: registro.origem_compra || '', tipo_compra: registro.tipo_compra || '', categoria: registro.categoria || '' }), depois_json: JSON.stringify(depois) });
    return Response.json({ success: true, classificacao: depois, vinculos_atualizados: vinculosAtualizados, filhos_atualizados: filhosAtualizados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}