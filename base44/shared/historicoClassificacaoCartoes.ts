import { resolverCadastro, validarCombinacao } from './classificacaoFinanceira.ts';
import { estaConferido, chaveGrupoCartao, estabelecimentoChave, estabelecimentoGenerico } from './grupoCartaoRevisao.ts';
export function mesAnteriorCartao(mes) {
  const [ano, numero] = mes.split('-').map(Number);
  return numero === 1 ? `${ano - 1}-12` : `${ano}-${String(numero - 1).padStart(2, '0')}`;
}
export async function analisarHistoricoCartoes(db, meses, role, offset, limit, incluirConferidos = false) {
  const periodos = [...new Set([...meses, ...meses.map(mesAnteriorCartao)])];
  const [faturasPage, cadastroPage] = await Promise.all([
    db.FaturaCartao.filter({ mes_referencia: { $in: periodos } }, { limit: 100, fields: ['mes_referencia','conta_cartao_id'] }),
    db.CadastroClassificacao.list({ limit: 300, fields: ['eixo','chave','rotulo','ativo','perfis_permitidos','naturezas_vinculadas','natureza_vinculada','centros_custo_vinculados'] }),
  ]);
  if (faturasPage.has_more || cadastroPage.has_more) throw new Error('Selecione um mês por vez; a revisão não pode usar uma base incompleta.');
  const faturas = faturasPage.items, cadastro = cadastroPage.items;
  const permitidos = resolverCadastro(cadastro, role);
  const rotulos = Object.fromEntries(['origem','tipo','categoria'].map(eixo => [eixo, Object.fromEntries(cadastro.filter(c => c.eixo === eixo).map(c => [c.chave,c.rotulo]))]));
  if (!faturas.length) return { rotulos, revisoes: meses.map(mes => ({ mes, mes_anterior: mesAnteriorCartao(mes), faturas: 0, resumo: { total_grupos: 0, total_pendentes: 0 }, itens: [], has_more: false, next_offset: 0 })) };
  const query = { fatura_id: { $in: faturas.map(f => f.id) }, valor: { $gt: 0 }, observacao: { $not: { $regex: 'Não faz parte', $options: 'i' } }, estabelecimento: { $not: { $regex: 'pagamento.*fatura|pgto.*fatura|pagto.*fatura|credito.*pagamento', $options: 'i' } } };
  const [eixos, contas, cards] = await Promise.all([
    db.LancamentoCartao.aggregate({ query, groupBy: ['fatura_id','estabelecimento','origem_compra','tipo_compra'], sum: 'valor', limit: 1000 }),
    db.LancamentoCartao.aggregate({ query, groupBy: ['fatura_id','estabelecimento','categoria','natureza'], sum: 'valor', limit: 1000 }),
    db.ContaCartao.list({ limit: 100, fields: ['nome'] }),
  ]);
  if (eixos.truncated || contas.truncated || cards.has_more) throw new Error('A revisão excedeu o limite de grupos. Selecione um mês por vez; nenhum resultado parcial será tratado como completo.');
  // Conferências válidas por grupo: só contam compras cuja classificação continua igual à conferida.
  const idsRevisados = faturas.filter(f => meses.includes(f.mes_referencia)).map(f => f.id);
  const conferidosGrupo = new Map();
  let cursor = null;
  for (let pagina = 0; idsRevisados.length; pagina++) {
    if (pagina === 10) throw new Error('A revisão excedeu o limite de conferências. Selecione um mês por vez; nenhum resultado parcial será tratado como completo.');
    const lote = await db.LancamentoCartao.filter({ ...query, fatura_id: { $in: idsRevisados }, classificacao_conferida: { $regex: '.' } }, { limit: 500, fields: ['fatura_id','estabelecimento','origem_compra','tipo_compra','categoria','classificacao_conferida'], ...(cursor ? { cursor } : {}) });
    for (const l of lote.items) if (estaConferido(l)) conferidosGrupo.set(chaveGrupoCartao(l), (conferidosGrupo.get(chaveGrupoCartao(l)) || 0) + 1);
    if (!lote.has_more) break;
    cursor = lote.next_cursor;
  }
  const fatMap = new Map(faturas.map(f => [f.id,f]));
  const cardMap = new Map(cards.items.map(c => [c.id,c.nome]));
  const categorias = new Map(), memoria = new Map();
  for (const row of contas.rows) {
    const chave = `${row.fatura_id}|${estabelecimentoChave(row.estabelecimento)}`;
    const valores = categorias.get(chave) || new Set(); valores.add(row.categoria || ''); categorias.set(chave,valores);
  }
  for (const row of eixos.rows) {
    const f = fatMap.get(row.fatura_id); if (!f) continue;
    const chave = `${f.mes_referencia}|${f.conta_cartao_id}|${estabelecimentoChave(row.estabelecimento)}`;
    const valores = memoria.get(chave) || new Map();
    const cats = categorias.get(`${row.fatura_id}|${estabelecimentoChave(row.estabelecimento)}`) || new Set(['']);
    for (const categoria of cats) {
      const classificacao = { origem_compra: row.origem_compra || '', tipo_compra: row.tipo_compra || '', categoria };
      valores.set(JSON.stringify(classificacao), classificacao);
    }
    memoria.set(chave,valores);
  }
  const revisoes = meses.map(mes => {
    const anterior = mesAnteriorCartao(mes), itens = [];
    const resumo = { lancamentos: 0, valor: 0, pendentes_eixos: 0, valor_pendente_eixos: 0, pendentes_categorias: 0, valor_pendente_categorias: 0, iguais: 0, divergentes: 0, sem_historico: 0, historico_inconsistente: 0, conferidos: 0 };
    for (const row of contas.rows) {
      if (fatMap.get(row.fatura_id)?.mes_referencia !== mes) continue;
      if (!row.categoria || row.categoria === 'outro' || (permitidos.categorias.length && !permitidos.categorias.includes(row.categoria))) {
        resumo.pendentes_categorias += row.count; resumo.valor_pendente_categorias += row.sum_valor || 0;
      }
    }
    for (const row of eixos.rows) {
      const fat = fatMap.get(row.fatura_id); if (fat?.mes_referencia !== mes) continue;
      const cats = [...(categorias.get(`${row.fatura_id}|${estabelecimentoChave(row.estabelecimento)}`) || new Set(['']))];
      const pendente = !permitidos.origens.includes(row.origem_compra) || !permitidos.tipos.includes(row.tipo_compra);
      resumo.lancamentos += row.count; resumo.valor += row.sum_valor || 0;
      if (pendente) { resumo.pendentes_eixos += row.count; resumo.valor_pendente_eixos += row.sum_valor || 0; }
      const historico = memoria.get(`${anterior}|${fat.conta_cartao_id}|${estabelecimentoChave(row.estabelecimento)}`);
      let sugestao = null, status = 'sem_historico';
      if (historico) {
        const valores = [...historico.values()];
        const unico = valores.length === 1 ? valores[0] : null;
        const normalizado = unico ? validarCombinacao('LancamentoCartao', { ...unico, natureza: unico.origem_compra === 'pro_labore' ? 'pessoal' : 'empresarial' }, cadastro, role).normalizado : null;
        const coerente = unico && ['origem_compra','tipo_compra','categoria'].every(c => unico[c] === normalizado[c]);
        const valido = coerente && permitidos.origens.includes(unico.origem_compra) && permitidos.tipos.includes(unico.tipo_compra) && unico.categoria && unico.categoria !== 'outro' && (!permitidos.categorias.length || permitidos.categorias.includes(unico.categoria)) && (unico.origem_compra !== 'pro_labore' || unico.tipo_compra === 'pro_labore');
        const generico = estabelecimentoGenerico(estabelecimentoChave(row.estabelecimento));
        if (valido && !generico) {
          sugestao = unico;
          status = row.origem_compra === unico.origem_compra && row.tipo_compra === unico.tipo_compra && cats.length === 1 && cats[0] === unico.categoria ? 'iguais' : 'divergentes';
        } else status = 'historico_inconsistente';
      }
      const pendenteCategoria = cats.some(c => !c || c === 'outro' || (permitidos.categorias.length && !permitidos.categorias.includes(c)));
      const conferido = !pendente && !pendenteCategoria && (conferidosGrupo.get(chaveGrupoCartao(row)) || 0) >= row.count;
      resumo[conferido ? 'conferidos' : status] += 1;
      itens.push({ fatura_id: fat.id, cartao: cardMap.get(fat.conta_cartao_id) || fat.conta_cartao_id, estabelecimento: row.estabelecimento, quantidade: row.count, valor: row.sum_valor, atual: { origem_compra: row.origem_compra || '', tipo_compra: row.tipo_compra || '', categorias: cats }, pendente, pendente_categoria: pendenteCategoria, status, sugestao, conferido });
    }
    // Igual ao mês anterior não substitui a conferência; categorias pendentes nunca são ocultadas.
    itens.sort((a,b) => Number(b.pendente || b.pendente_categoria) - Number(a.pendente || a.pendente_categoria) || Number(a.conferido) - Number(b.conferido) || Number(b.status === 'divergentes') - Number(a.status === 'divergentes') || b.valor - a.valor || chaveGrupoCartao(a).localeCompare(chaveGrupoCartao(b)));
    const pendentes = itens.filter(item => !item.conferido);
    resumo.total_grupos = itens.length; resumo.total_pendentes = pendentes.length;
    const visiveis = incluirConferidos ? itens : pendentes;
    return { mes, mes_anterior: anterior, faturas: faturas.filter(f => f.mes_referencia === mes).length, resumo, itens: visiveis.slice(offset, offset + limit), has_more: visiveis.length > offset + limit, next_offset: offset + limit };
  });
  return { rotulos, revisoes };
}