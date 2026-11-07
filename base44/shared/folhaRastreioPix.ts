import { periodoPagamentoFolha } from './folhaCalendario.ts';
import { normConciliacao } from './conciliacaoLeitura.ts';

// Rastreio somente leitura: interpreta cada PIX vinculado pela descrição, data e valor.
export const TOLERANCIA = 50;
const TERMOS = [
  ['adiantamento', /\b(adiant\w*|vale|antecip\w*)\b/, 'Descrição indica adiantamento/vale'],
  ['comissao', /\b(comiss\w*|premio|premiacao|bonus|meta|vendas?)\b/, 'Descrição indica comissão'],
  ['salario', /\b(salario|folha|ferias|rescisao|decimo|13o)\b/, 'Descrição indica salário'],
];
const tokens = nome => normConciliacao(nome).split(' ').filter(t => t.length >= 3 && !/^\d+$/.test(t)).map(t => t.replace(/h/g, '').replace(/y/g, 'i').replace(/(.)\1+/g, '$1'));

export function beneficiarioConfere(nome, texto) {
  const alvo = tokens(nome), desc = new Set(tokens(texto));
  const iguais = alvo.filter(t => desc.has(t)).length;
  return iguais >= 2 || (iguais === 1 && (alvo.length === 1 || alvo[0].length >= 5) && desc.has(alvo[0]));
}

export function vencimentoRastreio(folha) {
  if ((folha.tipo || 'mensal') !== 'mensal') return { vencimento: folha.data_pagamento || null, janela: null };
  const j = periodoPagamentoFolha(folha.competencia);
  return { vencimento: j?.fim || null, janela: j };
}

// Retorna { tipo, motivo } — tipo: salario | comissao | complemento | adiantamento | suspeito
export function classificarPix(folha, lanc, vinculo, janela, valor) {
  const texto = normConciliacao(`${lanc?.descricao || ''} ${lanc?.detalhe || ''} ${vinculo?.conciliado_por === 'manual' ? vinculo.observacao || '' : ''}`);
  const termo = TERMOS.find(([, re]) => re.test(texto));
  const liquido = Number(folha.salario_liquido || 0);
  if (!termo && liquido > 0 && valor > liquido * 1.5 + TOLERANCIA) return { tipo: 'suspeito', motivo: 'Valor muito acima do líquido da folha e sem descrição que explique' };
  if (termo) return { tipo: termo[0], motivo: termo[2] };
  const data = lanc?.data || '';
  if (!janela) return { tipo: 'salario', motivo: 'Pagamento da folha especial (férias/13º/rescisão)' };
  if (data.slice(0, 7) <= folha.competencia) return { tipo: 'adiantamento', motivo: 'PIX dentro do mês trabalhado: vale' };
  if (data.slice(0, 7) === janela.mes_pagamento) {
    const dia = Number(data.slice(8, 10));
    if (dia >= 10) return Number(folha.comissao || 0) > 0 ? { tipo: 'comissao', motivo: 'PIX a partir do dia 10 com comissão na folha' } : { tipo: 'complemento', motivo: 'PIX a partir do dia 10' };
    if (data < janela.inicio) return { tipo: 'salario', motivo: 'Salário pago antes do 5º dia útil' };
    if (data <= janela.fim) return { tipo: 'salario', motivo: 'Salário pago entre o 5º e 7º dia útil' };
    return { tipo: 'salario', motivo: 'Salário pago após o 7º dia útil' };
  }
  return { tipo: 'complemento', motivo: 'Pago depois do mês de vencimento (atraso)' };
}

export function situacaoRastreio({ liquido, pago, aConfirmar, vencimento, hoje }) {
  const saldo = liquido - pago;
  if (saldo < -TOLERANCIA) return 'pago_a_maior';
  if (saldo <= TOLERANCIA) return 'quitada';
  if (aConfirmar > 0 && saldo - aConfirmar <= TOLERANCIA) return 'a_confirmar';
  if (vencimento && hoje <= vencimento) return pago > 0 ? 'parcial_a_vencer' : 'a_vencer';
  return pago > 0 ? 'parcial' : 'vencida';
}