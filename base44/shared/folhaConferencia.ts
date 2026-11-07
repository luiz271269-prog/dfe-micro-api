import { periodoPagamentoFolha } from './folhaCalendario.ts';
import { centavos, normConciliacao } from './conciliacaoLeitura.ts';

const DESCONTOS = ['desconto_inss', 'desconto_irrf', 'desconto_vt', 'desconto_vr', 'outros_descontos'];
const IGNORAR = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

export function mesSeguinte(comp: string) {
  const [a, m] = comp.split('-').map(Number);
  const d = new Date(Date.UTC(a, m, 1));
  return d.toISOString().slice(0, 7);
}
function mesAnterior(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 7);
}

// Composição: proventos e descontos calculados a partir dos campos, sem reescrever o líquido armazenado.
export function composicaoFolha(f) {
  const eventos = f.eventos || [];
  const proventosEventos = eventos.filter(e => e.tipo === 'provento').reduce((s, e) => s + centavos(e.valor), 0);
  const descontosEventos = eventos.filter(e => e.tipo === 'desconto').reduce((s, e) => s + centavos(e.valor), 0);
  const proventos = centavos(f.salario_bruto) + centavos(f.comissao) + centavos(f.horas_extras) + proventosEventos;
  const descontos = DESCONTOS.reduce((s, k) => s + centavos(f[k]), 0) + descontosEventos;
  const calculado = proventos - descontos, armazenado = centavos(f.salario_liquido);
  const alertas = [];
  if (Math.abs(calculado - armazenado) > 1) {
    const razao = armazenado ? calculado / armazenado : 0;
    alertas.push(razao > 900 && razao < 1100 ? 'escala_suspeita' : 'liquido_divergente');
  }
  return { proventos, descontos, calculado, armazenado, diferenca: armazenado - calculado, alertas };
}

// Categoria só a partir de evidência explícita (tipo do vínculo ou observação); sem inferir.
export function categoriaVinculo(v) {
  if (v.tipo_vinculo === 'adiantamento') return 'adiantamento';
  if (v.tipo_vinculo === 'estorno') return 'estorno';
  const obs = normConciliacao(v.observacao);
  if (obs.includes('comiss')) return 'comissao';
  if (obs.includes('complement')) return 'complemento';
  if (obs.includes('salari')) return 'salario';
  return 'sem_discriminacao';
}

function tokensNome(nome: string) {
  return normConciliacao(nome).split(' ').filter(t => t.length >= 3 && !IGNORAR.has(t));
}

// Janela: adiantamento no mês da competência; salário/complemento/comissão no mês seguinte a partir do 5º dia útil.
export function avaliarVinculo(v, folha, lanc, alocadoNoLancamento, duplicado) {
  const categoria = categoriaVinculo(v);
  const alertas = [], info = [];
  let competenciaSugerida = null;
  if (!lanc) alertas.push('sem_lancamento');
  else {
    const data = String(lanc.data || '').slice(0, 10), mes = data.slice(0, 7);
    if (centavos(lanc.valor) >= 0 && categoria !== 'estorno') alertas.push('nao_debito');
    if (alocadoNoLancamento > Math.abs(centavos(lanc.valor)) + 1) alertas.push('alocacao_excede_debito');
    if (folha && (folha.tipo || 'mensal') === 'mensal' && data) {
      const janela = periodoPagamentoFolha(folha.competencia);
      if (categoria === 'adiantamento') {
        if (mes !== folha.competencia) { alertas.push('adiantamento_fora_competencia'); competenciaSugerida = mes; }
      } else if (categoria !== 'estorno' && janela) {
        if (mes !== janela.mes_pagamento) { alertas.push('mes_divergente'); competenciaSugerida = mesAnterior(mes); }
        else if (data < janela.inicio) alertas.push('antes_janela');
        else if (data > janela.fim) info.push('apos_prazo');
      }
    }
    if (folha) {
      const tokens = tokensNome(folha.funcionario_nome);
      const texto = normConciliacao(`${lanc.descricao || ''} ${lanc.detalhe || ''}`);
      if (tokens.length === 1) alertas.push('identidade_ambigua');
      else if (tokens.length && !tokens.some(t => texto.split(' ').includes(t))) alertas.push('beneficiario_nao_confirmado');
    }
  }
  if (duplicado) alertas.push('vinculo_duplicado');
  const foraJanela = naturezaForaJanela(v, folha, lanc, categoria);
  return {
    fora_janela: foraJanela, natureza_texto: lanc && categoria !== 'estorno' ? analisarTextoPix(v, lanc) : null,
    id: v.id, categoria, tipo_vinculo: v.tipo_vinculo || 'pagamento_integral', observacao: v.observacao || '',
    conciliado_por: v.conciliado_por || '', valor: centavos(v.valor_alocado),
    lancamento_bancario_id: v.lancamento_bancario_id, data: lanc?.data || null, descricao_banco: lanc?.descricao || '',
    valor_banco: lanc ? centavos(lanc.valor) : null, alocado_no_lancamento: alocadoNoLancamento,
    competencia_sugerida: competenciaSugerida, alertas, info,
  };
}

// PIX fora da janela (5º–7º dia útil do mês seguinte): natureza INFERIDA, nunca persistida nem confirmada.
// Adiantamento só com identificação explícita (vínculo, observação ou descrição bancária);
// comissão informada só pela observação; a partir do dia 10 é apenas "possível comissão" pelo padrão histórico.
const TERMOS_PIX = [
  ['adiantamento', /\b(adiant\w*|adto|adt|antecip\w*|vale)\b/],
  ['comissao_informada', /\b(comis\w*|comiss\w*)\b/],
  ['possivel_comissao', /\b(premi\w*|bonus|bonif\w*|metas?|vendas?|incentivo)\b/],
];

// Lê sempre o texto do PIX (descrição, detalhe bancário e observação do vínculo). Indicação, nunca confirmação.
export function analisarTextoPix(v, lanc) {
  if (v.tipo_vinculo === 'adiantamento') return { natureza: 'adiantamento', termo: 'vínculo marcado como adiantamento' };
  const texto = normConciliacao(`${lanc?.descricao || ''} ${lanc?.detalhe || ''} ${v.observacao || ''}`);
  for (const [natureza, re] of TERMOS_PIX) { const m = texto.match(re); if (m) return { natureza, termo: m[0] }; }
  return null;
}

export function naturezaForaJanela(v, folha, lanc, categoria) {
  if (!folha || !lanc || (folha.tipo || 'mensal') !== 'mensal' || categoria === 'estorno') return null;
  const data = String(lanc.data || '').slice(0, 10);
  const janela = periodoPagamentoFolha(folha.competencia);
  if (!data || !janela || (data >= janela.inicio && data <= janela.fim)) return null;
  const dia = Number(data.slice(8, 10));
  const texto = analisarTextoPix(v, lanc);
  const natureza = texto?.natureza || (dia >= 10 ? 'possivel_comissao' : 'nao_classificado');
  const origem = texto ? 'texto' : dia >= 10 ? 'data' : null;
  return { natureza, origem, termo: texto?.termo || null, dia, mes: data.slice(0, 7), janela_inicio: janela.inicio, janela_fim: janela.fim };
}

export function resumoEvidencias(folha, vinculos) {
  const por = { salario: 0, complemento: 0, comissao: 0, sem_discriminacao: 0, adiantamento: 0, estorno: 0 };
  for (const v of vinculos) por[v.categoria] += v.valor;
  const pagamentoBanco = por.salario + por.complemento + por.comissao + por.sem_discriminacao - por.estorno;
  const manuais = (folha.pagamentos_manuais || []).reduce((s, p) => s + centavos(p.valor), 0);
  return { por_categoria: por, pagamento_banco: pagamentoBanco, informado: centavos(folha.valor_pago), manuais };
}

export { mesAnterior };