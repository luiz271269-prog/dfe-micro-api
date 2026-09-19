const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export function descobrirFixas(lancamentos, regras = []) {
  const grupos = new Map();
  for (const l of lancamentos) {
    const texto = norm(l.descricao);
    if (!(l.valor < 0) || !l.data || l.alerta_duplicidade || l.duplicidade_ref || /PAG.*FATURA|ESTORNO|NAO FAZ PARTE|SALDO ANTERIOR|PAGAMENTO RECEBIDO/.test(norm(`${texto} ${l.detalhe || ''}`)) || ['transferencia', 'interno', 'aplicacoes', 'resgates'].includes(l.categoria)) continue;
    const chave = texto.split(' ').filter(p => p.length > 2 && !/^\d+$/.test(p)).slice(0, 4).join(' ');
    const canal = l.fonte === 'Cartão' ? 'cartao' : 'extrato';
    if (!chave) continue;
    const grupo = `${canal}|${l.empresa || l.empresa_beneficiada || ''}|${l.fatura_conta_id || l.conta_bancaria || ''}|${chave}|${l.data.slice(8, 10)}`;
    if (!grupos.has(grupo)) grupos.set(grupo, { chave, canal, lista: [] });
    grupos.get(grupo).lista.push(l);
  }
  const sugestoes = [];
  for (const { chave, canal, lista } of grupos.values()) {
    if (regras.some(r => r.is_ativa && (!r.forma_pagamento || (r.forma_pagamento === 'cartao') === (canal === 'cartao')) && (!r.conta_bancaria || r.conta_bancaria === lista[0].conta_bancaria) && (!r.empresa || !(lista[0].empresa || lista[0].empresa_beneficiada) || r.empresa === (lista[0].empresa || lista[0].empresa_beneficiada)) && norm(r.padrao_descricao).split(' ').filter(p => p.length > 2).length && norm(r.padrao_descricao).split(' ').filter(p => p.length > 2).every(p => norm(lista[0].descricao).includes(p)))) continue;
    const meses = new Map();
    lista.forEach(l => { const m = l.data.slice(0, 7); meses.set(m, [...(meses.get(m) || []), l]); });
    let atual = [], melhor = [], anterior = -2;
    for (const mes of [...meses.keys()].sort()) {
      const [a, m] = mes.split('-').map(Number), indice = a * 12 + m;
      if (meses.get(mes).length !== 1) { atual = []; anterior = -2; continue; }
      atual = indice === anterior + 1 ? [...atual, meses.get(mes)[0]] : [meses.get(mes)[0]];
      anterior = indice;
      if (atual.length >= melhor.length) melhor = atual.slice(-5);
    }
    if (melhor.length < 2) continue;
    const valores = melhor.map(l => Math.abs(l.valor)), media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const desvio = Math.max(...valores.map(v => Math.abs(v - media) / media * 100));
    if (desvio > 20) continue;
    const ultimo = melhor[melhor.length - 1];
    sugestoes.push({ nome: chave, padrao_descricao: chave, fornecedor: ultimo.descricao, valor_esperado: Math.round(media * 100) / 100, tolerancia_percentual: Math.max(5, Math.ceil(desvio)), dia_vencimento: Number(ultimo.data.slice(8, 10)), frequencia: 'mensal', mes_inicio: melhor[0].data.slice(0, 7), forma_pagamento: canal === 'cartao' ? 'cartao' : 'pix', conta_bancaria: ultimo.conta_bancaria || '', empresa: ultimo.empresa || ultimo.empresa_beneficiada || '', categoria: ultimo.categoria, origem_compra: ultimo.origem_compra, tipo_compra: ultimo.tipo_compra, meses_distintos: melhor.length, ocorrencias: melhor.length, amostra: melhor, canal });
  }
  return sugestoes.sort((a, b) => b.meses_distintos - a.meses_distintos);
}
export function proximaPrevisao(regra, desde) {
  if (!regra.is_ativa) return null;
  const inicio = new Date(`${desde}T12:00:00Z`);
  if (regra.frequencia === 'semanal') {
    if (!regra.data_inicio) return null;
    const d = new Date(`${regra.data_inicio}T12:00:00Z`), passos = Math.max(0, Math.ceil((inicio - d) / 604800000));
    return new Date(d.getTime() + passos * 604800000).toISOString().slice(0, 10);
  }
  if (!(regra.dia_vencimento > 0)) return null;
  const intervalo = { mensal: 1, trimestral: 3, anual: 12 }[regra.frequencia || 'mensal'];
  if (!intervalo || (intervalo > 1 && !regra.mes_inicio)) return null;
  const [ia, im] = (regra.mes_inicio || desde.slice(0, 7)).split('-').map(Number);
  for (let i = 0; i < 120; i++) {
    const d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + i, 1, 12)), a = d.getUTCFullYear(), m = d.getUTCMonth();
    const distancia = (a - ia) * 12 + m + 1 - im;
    d.setUTCDate(Math.min(regra.dia_vencimento, new Date(Date.UTC(a, m + 1, 0)).getUTCDate()));
    if (distancia >= 0 && distancia % intervalo === 0 && d >= inicio) return d.toISOString().slice(0, 10);
  }
  return null;
}