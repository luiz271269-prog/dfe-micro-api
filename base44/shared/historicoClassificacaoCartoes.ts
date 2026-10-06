import { resolverCadastro } from './classificacaoFinanceira.ts';
export function mesAnteriorCartao(mes) {
  const [ano, numero] = mes.split('-').map(Number);
  return numero === 1 ? `${ano - 1}-12` : `${ano}-${String(numero - 1).padStart(2, '0')}`;
}
function estabelecimentoChave(valor) {
  // Conserva vendedor, filial e códigos: não confunde compras diferentes em marketplaces.
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\d{1,2}\s*\/\s*\d{1,2}/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
export async function analisarHistoricoCartoes(db, meses, role, offset, limit) {
  const periodos = [...new Set([...meses, ...meses.map(mesAnteriorCartao)])];
  const [faturasPage, cadastroPage] = await Promise.all([
    db.FaturaCartao.filter({ mes_referencia: { $in: periodos } }, { limit: 100, fields: ['mes_referencia','conta_cartao_id'] }),
    db.CadastroClassificacao.list({ limit: 300, fields: ['eixo','chave','rotulo','ativo','perfis_permitidos'] }),
  ]);
  if (faturasPage.has_more || cadastroPage.has_more) throw new Error('Selecione um mês por vez; a revisão não pode usar uma base incompleta.');
  const faturas = faturasPage.items, cadastro = cadastroPage.items;
  const permitidos = resolverCadastro(cadastro, role);
  const rotulos = Object.fromEntries(['origem','tipo','categoria'].map(eixo => [eixo, Object.fromEntries(cadastro.filter(c => c.eixo === eixo).map(c => [c.chave,c.rotulo]))]));
  if (!faturas.length) return { rotulos, revisoes: meses.map(mes => ({ mes, mes_anterior: mesAnteriorCartao(mes), faturas: 0, resumo: {}, itens: [], has_more: false })) };
  const query = { fatura_id: { $in: faturas.map(f => f.id) }, valor: { $gt: 0 }, observacao: { $not: { $regex: 'Não faz parte', $options: 'i' } }, estabelecimento: { $not: { $regex: 'pagamento.*fatura|pgto.*fatura|pagto.*fatura|credito.*pagamento', $options: 'i' } } };
  const [eixos, contas, cards] = await Promise.all([
    db.LancamentoCartao.aggregate({ query, groupBy: ['fatura_id','estabelecimento','origem_compra','tipo_compra'], sum: 'valor', limit: 1000 }),
    db.LancamentoCartao.aggregate({ query, groupBy: ['fatura_id','estabelecimento','categoria','natureza'], sum: 'valor', limit: 1000 }),
    db.ContaCartao.list({ limit: 100, fields: ['nome'] }),
  ]);
  if (eixos.truncated || contas.truncated || cards.has_more) throw new Error('A revisão excedeu o limite de grupos. Selecione um mês por vez; nenhum resultado parcial será tratado como completo.');
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
    const resumo = { lancamentos: 0, valor: 0, pendentes_eixos: 0, valor_pendente_eixos: 0, iguais: 0, divergentes: 0, sem_historico: 0, historico_inconsistente: 0 };
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
        const valido = unico && permitidos.origens.includes(unico.origem_compra) && permitidos.tipos.includes(unico.tipo_compra) && unico.categoria && unico.categoria !== 'outro' && (!permitidos.categorias.length || permitidos.categorias.includes(unico.categoria)) && (unico.origem_compra !== 'pro_labore' || unico.tipo_compra === 'pro_labore');
        if (valido) {
          sugestao = unico;
          status = row.origem_compra === unico.origem_compra && row.tipo_compra === unico.tipo_compra && cats.length === 1 && cats[0] === unico.categoria ? 'iguais' : 'divergentes';
        } else status = 'historico_inconsistente';
      }
      resumo[status] += 1;
      itens.push({ fatura_id: fat.id, cartao: cardMap.get(fat.conta_cartao_id) || fat.conta_cartao_id, estabelecimento: row.estabelecimento, quantidade: row.count, valor: row.sum_valor, atual: { origem_compra: row.origem_compra || '', tipo_compra: row.tipo_compra || '', categorias: cats }, pendente, status, sugestao });
    }
    itens.sort((a,b) => Number(b.pendente) - Number(a.pendente) || Number(b.status === 'divergentes') - Number(a.status === 'divergentes') || b.valor - a.valor);
    return { mes, mes_anterior: anterior, faturas: faturas.filter(f => f.mes_referencia === mes).length, resumo, itens: itens.slice(offset, offset + limit), has_more: itens.length > offset + limit, next_offset: offset + limit };
  });
  return { rotulos, revisoes };
}