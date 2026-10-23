import { MODULOS_BAIXA, ehMovimento, normalizarBaixa, dinheiroBaixa } from './baixasContrato.ts';
import { consultarListaBaixas } from './baixasConsulta.ts';
import { pontuarBaixa, ordenarCandidatosBaixa } from './baixasSemelhanca.ts';

export async function movimentosDaObrigacao(base44, user, b) {
  if (!MODULOS_BAIXA[b.tipo] || ehMovimento(b.tipo) || !['banco', 'cartao'].includes(b.canal)) throw new Error('Selecione uma obrigação e a rota banco ou cartão.');
  if (b.canal === 'cartao' && !['ItemCompra', 'DespesaOperacional', 'ObraReforma'].includes(b.tipo)) throw new Error('Este módulo é conciliado pelo banco, não por uma compra no cartão.');
  const db = base44.entities, raw = await db[b.tipo].get(b.id), doc = normalizarBaixa(b.tipo, raw);
  if (b.tipo === 'FaturaCartao') doc.empresa = (await db.ContaCartao.get(raw.conta_cartao_id)).empresa_vinculada || '';
  const [bancos, cartoes] = await Promise.all([
    db.VinculoExtrato.aggregate({ query: { entidade_tipo: b.tipo, entidade_id: b.id }, sum: 'valor_alocado' }),
    db.VinculoCartao.count({ entidade_tipo: b.tipo, entidade_id: b.id, fase: { $ne: 'cancelado' } }),
  ]);
  const conciliado = dinheiroBaixa(bancos.rows[0]?.sum_valor_alocado);
  const declarado = doc.pago > conciliado + 0.01;
  if (cartoes || raw.lancamento_cartao_id) return { items: [], has_more: false, aviso: 'Documento já reconhecido no cartão. Confira o vínculo e o pagamento da fatura no histórico.' };
  if (declarado) return { items: [], has_more: false, aviso: 'Existe pagamento declarado sem extrato. Revise e reverta a declaração no histórico antes de conciliar, para não duplicar a baixa.' };
  doc.saldo = dinheiroBaixa(Math.max(0, doc.total - conciliado));
  if (doc.saldo <= 0) return { items: [], has_more: false, aviso: 'Obrigação sem saldo em aberto. Consulte os vínculos e o histórico.' };
  const tipo = b.canal === 'banco' ? 'LancamentoBancario' : 'LancamentoCartao';
  const page = await consultarListaBaixas(db, { tipo, busca: b.busca, mes: b.mes, cursor: b.cursor, estado: 'disponivel', registro_id: b.movimento_id });
  const items = page.items.map(m => {
    const analise = pontuarBaixa(m, doc), bloqueios = [...analise.bloqueios];
    if (m.saldo <= 0) bloqueios.push('Movimento sem saldo disponível');
    if (b.canal === 'banco' && ['transferencia', 'interno', 'aplicacoes', 'resgates'].includes(m.raw.categoria)) bloqueios.push('Movimento interno não é pagamento de obrigação');
    if (b.canal === 'cartao' && conciliado > 0) bloqueios.push('Documento com pagamento bancário já associado');
    return { ...m, pontos: analise.pontos, razoes: analise.razoes, bloqueios: [...new Set(bloqueios)] };
  });
  return { ...page, items: ordenarCandidatosBaixa(items), aviso: 'Sugestões para este documento, ordenadas por semelhança nesta página. Nada é baixado ao analisar; confira a evidência antes de confirmar.' };
}