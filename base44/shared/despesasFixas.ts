export const normalizarFixa = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export async function carregarFixas(db, entidade, filtro) {
  const rows = [];
  for (let skip = 0; ; skip += 200) {
    const page = await db[entidade].filter(filtro, 'id', 200, skip);
    rows.push(...page);
    if (page.length < 200) return rows;
  }
}
export function avaliarFixa(r, l, canal) {
  const data = canal === 'cartao' ? l.data_lancamento : l.data;
  const texto = normalizarFixa(canal === 'cartao' ? `${l.estabelecimento} ${l.observacao || ''}` : `${l.descricao} ${l.detalhe || ''}`);
  if (!r.is_ativa || !data || (canal === 'cartao' ? !(l.valor > 0) : !(l.valor < 0))) return null;
  if (/PAGAMENTO.*FATURA|PAG.*FATURA|ESTORNO|NAO FAZ PARTE|SALDO ANTERIOR|PAGAMENTO RECEBIDO/.test(texto) || ['transferencia', 'interno', 'aplicacoes', 'resgates'].includes(l.categoria)) return null;
  if (r.forma_pagamento && ((r.forma_pagamento === 'cartao') !== (canal === 'cartao'))) return null;
  if (r.empresa && (l.empresa || l.empresa_beneficiada) && r.empresa !== (l.empresa || l.empresa_beneficiada)) return null;
  if (canal === 'extrato' && r.conta_bancaria && r.conta_bancaria !== l.conta_bancaria) return null;
  const palavras = normalizarFixa(r.padrao_descricao).split(' ').filter(p => p.length > 2);
  if (!palavras.length || !palavras.every(p => texto.includes(p))) return null;
  const [ano, mes, dia] = data.split('-').map(Number);
  const [ia, im] = (r.mes_inicio || data.slice(0, 7)).split('-').map(Number);
  const distancia = (ano - ia) * 12 + mes - im;
  const freq = r.frequencia || 'mensal';
  const intervalo = { mensal: 1, trimestral: 3, anual: 12 }[freq];
  const dias = r.data_inicio ? Math.round((Date.parse(data + 'T12:00:00Z') - Date.parse(r.data_inicio + 'T12:00:00Z')) / 86400000) : -1;
  const ciclo = freq === 'semanal' ? dias >= 0 && dias % 7 === 0 : !!intervalo && distancia >= 0 && distancia % intervalo === 0 && (intervalo === 1 || !!r.mes_inicio);
  const esperado = Math.min(Number(r.dia_vencimento), new Date(Date.UTC(ano, mes, 0)).getUTCDate());
  const dataOk = ciclo && (freq === 'semanal' || (esperado >= 1 && dia === esperado));
  const valorOk = Number(r.valor_esperado) > 0 && Math.abs(Math.abs(l.valor) - r.valor_esperado) / r.valor_esperado * 100 <= (r.tolerancia_percentual ?? 5);
  const motivos = [!dataOk && 'Data fora do dia/ciclo previsto', !valorOk && 'Valor fora da tolerância'].filter(Boolean);
  return { bloqueada: motivos.length > 0, motivo: motivos.join(' · ') || 'Descrição, data e valor compatíveis; confirmar após revisão', data, valor: Math.abs(l.valor), diff_dias: freq === 'semanal' ? 0 : esperado ? dia - esperado : 0, vencimento: freq === 'semanal' ? data : `${data.slice(0, 7)}-${String(esperado || dia).padStart(2, '0')}` };
}
export async function validarClassificacaoFixa(db, regra) {
  if (!regra.origem_compra || !regra.tipo_compra || !regra.categoria) throw new Error('Complete a classificação da despesa fixa.');
  const categorias = await db.CadastroClassificacao.filter({ eixo: 'categoria', chave: regra.categoria, ativo: true });
  if (!categorias.length) throw new Error('Conta do plano de contas ausente ou inativa. Revise o cadastro.');
  const naturezas = categorias[0].naturezas_vinculadas?.length ? categorias[0].naturezas_vinculadas : [categorias[0].natureza_vinculada].filter(Boolean);
  if (naturezas.length && !naturezas.includes(regra.tipo_compra)) throw new Error('Conta incompatível com o tipo de compra.');
}