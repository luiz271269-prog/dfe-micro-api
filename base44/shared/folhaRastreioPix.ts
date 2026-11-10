import { periodoPagamentoFolha } from './folhaCalendario.ts';
import { normConciliacao } from './conciliacaoLeitura.ts';

// Rastreio e auditoria somente leitura: interpreta cada PIX vinculado ou candidato pela descrição, data (5º–7º dia útil do mês seguinte) e valor.
export const TOLERANCIA = 50;

const TERMOS_DESCRICAO_BANCARIA = [
  ['adiantamento', /\b(adiant\w*|vale|antecip\w*)\b/, 'Descrição bancária indica adiantamento/vale'],
  ['comissao', /\b(comiss\w*|premio|premiacao|bonus|meta|vendas?)\b/, 'Descrição bancária indica comissão'],
  ['salario', /\b(salario|folha|ferias|rescisao|decimo|13o)\b/, 'Descrição bancária indica salário'],
];

const NAO_PIX_RE = /\b(saque\s+din|tarifa\s+com|iof\s+|debito\s+convenios|liquidacao\s+boleto)\b/;

// Homônimos de terceiros/fornecedores que não são funcionários da folha
const TERCEIROS_HOMONIMOS_RE = /\b(05385362921|matheus\s+aguiar|14088242998|mateus\s+de\s+santana\s+marq|05923576945|paulo\s+alves\s+de\s+araujo|88882160904|aida\s+teresinha)\b/;

const PERFIS_COLABORADORES = [
  { chave: 'gustavo', matchNome: /\bgustavo\b/, matchBanco: /\b(11522298932|gustavo\s+nunes)\b/ },
  { chave: 'stefhany', matchNome: /\bstefhany\b/, matchBanco: /\b(12773454901|stefhany\s+santana)\b/ },
  { chave: 'paulo', matchNome: /\bpaulo\s+henrique\b/, matchBanco: /\b(08429678930|paulo\s+henrique\s+jan?ques)\b/ },
  { chave: 'ricardo', matchNome: /\bricardo\s+rodolfo\b/, matchBanco: /\b(73926302968|ricardo\s+rodolfo)\b/ },
  { chave: 'thiago', matchNome: /\b(thiago|tiago)\b/, matchBanco: /\b(09865998750|th?iago\s+alves|thiago\s+salario)\b/ },
  { chave: 'thais', matchNome: /\bthais\b/, matchBanco: /\b(08644621904|thais\s+moreira|thais\s+spido)\b/ },
  { chave: 'luiz_gabriel', matchNome: /\bluiz\s+gabriel\b/, matchBanco: /\b(14159808964|luiz\s+gabriel)\b/ },
  { chave: 'luiz_carlos', matchNome: /\bluiz\s+carlos\b/, matchBanco: /\b(71917489900|luiz\s+carlos\s+liesch)\b/ },
  { chave: 'tifany', matchNome: /\btifh?any\b/, matchBanco: /\b(11839063904|tifh?any\s+santann?a)\b/ },
  { chave: 'matheus', matchNome: /\bmatheus\b/, matchBanco: /\b(04619841056|matheus\s+message\s+model|matheus\s+salario)\b/ },
];

const tokens = nome =>
  normConciliacao(nome)
    .split(' ')
    .filter(t => t.length >= 3 && !/^\d+$/.test(t) && !['ltda', 'me', 'eireli', 'model', 'message', 'das', 'dos'].includes(t))
    .map(t => t.replace(/h/g, '').replace(/y/g, 'i').replace(/(.)\1+/g, '$1'));

export function ehLancamentoNaoPixNominal(lanc) {
  const txt = normConciliacao(`${lanc?.descricao || ''} ${lanc?.detalhe || ''}`);
  return NAO_PIX_RE.test(txt);
}

export function beneficiarioConfere(nome, texto) {
  const nomeNorm = normConciliacao(nome);
  const txtNorm = normConciliacao(texto);
  if (!nomeNorm || !txtNorm) return false;
  if (TERCEIROS_HOMONIMOS_RE.test(txtNorm)) return false;

  const perfil = PERFIS_COLABORADORES.find(p => p.matchNome.test(nomeNorm));
  if (perfil) {
    return perfil.matchBanco.test(txtNorm);
  }

  const alvo = tokens(nome);
  const desc = new Set(tokens(texto));
  if (!alvo.length) return false;
  const iguais = alvo.filter(t => desc.has(t)).length;
  return alvo.length >= 2 ? iguais >= 2 : iguais >= 1;
}

export function vencimentoRastreio(folha) {
  if ((folha.tipo || 'mensal') !== 'mensal') {
    return { quinto_dia: folha.data_pagamento || null, vencimento: folha.data_pagamento || null, janela: null };
  }
  const j = periodoPagamentoFolha(folha.competencia);
  return { quinto_dia: j?.inicio || null, vencimento: j?.fim || null, janela: j };
}

export function ultimasCompetencias(hojeIso, qtd = 12) {
  const [anoRef, mesRef] = hojeIso.slice(0, 7).split('-').map(Number);
  // Último mês fechado = mês imediatamente anterior à data de referência (ex: em 2026-11, audita 2025-11 a 2026-10)
  const lista = [];
  for (let i = qtd; i >= 1; i--) {
    const d = new Date(Date.UTC(anoRef, mesRef - 1 - i, 1));
    lista.push(d.toISOString().slice(0, 7));
  }
  return lista;
}

// Retorna { tipo, motivo, naJanelaQuintoDia, gravadoComoValeNoQuintoDia }
export function classificarPix(folha, lanc, vinculo, janela, valor) {
  if (ehLancamentoNaoPixNominal(lanc)) {
    return {
      tipo: 'nao_pix',
      motivo: 'Lançamento bancário é saque em espécie, tarifa ou boleto, não PIX nominal ao funcionário',
      naJanelaQuintoDia: false,
      gravadoComoValeNoQuintoDia: false,
    };
  }
  const descBanco = normConciliacao(`${lanc?.descricao || ''} ${lanc?.detalhe || ''}`);
  const obsVinculo = normConciliacao(vinculo?.observacao || '');
  const termoBanco = TERMOS_DESCRICAO_BANCARIA.find(([, re]) => re.test(descBanco));
  const liquido = Number(folha.salario_liquido || 0);
  const data = lanc?.data || '';

  if (!termoBanco && liquido > 100 && valor > Math.max(liquido * 2.5, liquido + 5000)) {
    return {
      tipo: 'suspeito',
      motivo: `Valor do PIX (R$ ${valor.toFixed(2)}) incompatível com o líquido da folha (R$ ${liquido.toFixed(2)})`,
      naJanelaQuintoDia: false,
      gravadoComoValeNoQuintoDia: false,
    };
  }

  if (!janela) {
    return { tipo: 'salario', motivo: 'Pagamento de folha especial (férias/13º/rescisão)', naJanelaQuintoDia: true, gravadoComoValeNoQuintoDia: false };
  }

  const noMesPagamento = data.slice(0, 7) === janela.mes_pagamento;
  const diaMesPag = noMesPagamento ? Number(data.slice(8, 10)) : 0;
  const naJanelaQuintoAoSetimo = noMesPagamento && data >= janela.inicio && data <= janela.fim;
  const ateNonoDiaMesSeguinte = noMesPagamento && diaMesPag >= 1 && diaMesPag <= 9;
  const marcadoValeNoVinculo = vinculo?.tipo_vinculo === 'adiantamento' || /\b(adiant\w*|vale)\b/.test(obsVinculo);

  // Caso crítico dos últimos 12 meses: PIX pago no 5º–7º dia útil do mês seguinte, mas vínculo salvo como 'adiantamento'
  if (ateNonoDiaMesSeguinte && marcadoValeNoVinculo && !termoBanco) {
    return {
      tipo: 'adiantamento_em_dia_salario',
      motivo: naJanelaQuintoAoSetimo
        ? `PIX pago na janela do 5º ao 7º dia útil (${janela.inicio} a ${janela.fim}), mas vínculo foi gravado como adiantamento/vale`
        : `PIX pago no início do mês seguinte (${data}), mas vínculo foi gravado como adiantamento/vale`,
      naJanelaQuintoDia: naJanelaQuintoAoSetimo,
      gravadoComoValeNoQuintoDia: true,
    };
  }

  if (termoBanco) {
    return { tipo: termoBanco[0], motivo: termoBanco[2], naJanelaQuintoDia: naJanelaQuintoAoSetimo, gravadoComoValeNoQuintoDia: false };
  }

  if (data.slice(0, 7) <= folha.competencia) {
    if (marcadoValeNoVinculo || valor < liquido * 0.7) {
      return { tipo: 'adiantamento', motivo: 'PIX realizado dentro do próprio mês trabalhado (adiantamento/vale)', naJanelaQuintoDia: false, gravadoComoValeNoQuintoDia: false };
    }
    return {
      tipo: 'a_confirmar',
      motivo: `PIX datado em ${data} (dentro do mês ${folha.competencia}, fora do 5º dia útil do mês seguinte ${janela.inicio})`,
      naJanelaQuintoDia: false,
      gravadoComoValeNoQuintoDia: false,
    };
  }

  if (noMesPagamento) {
    if (naJanelaQuintoAoSetimo) {
      return { tipo: 'salario', motivo: `Pago na janela correta do 5º ao 7º dia útil (${janela.inicio} a ${janela.fim})`, naJanelaQuintoDia: true, gravadoComoValeNoQuintoDia: false };
    }
    if (data < janela.inicio) {
      return { tipo: 'salario', motivo: `Salário pago no mês seguinte antes do 5º dia útil (${janela.inicio})`, naJanelaQuintoDia: false, gravadoComoValeNoQuintoDia: false };
    }
    if (diaMesPag >= 10) {
      return Number(folha.comissao || 0) > 0
        ? { tipo: 'comissao', motivo: 'PIX a partir do dia 10 do mês seguinte com comissão na folha', naJanelaQuintoDia: false, gravadoComoValeNoQuintoDia: false }
        : { tipo: 'complemento', motivo: `PIX no mês seguinte após o 7º dia útil (${janela.fim})`, naJanelaQuintoDia: false, gravadoComoValeNoQuintoDia: false };
    }
    return { tipo: 'salario', motivo: `Salário pago logo após o 7º dia útil (${janela.fim})`, naJanelaQuintoDia: false, gravadoComoValeNoQuintoDia: false };
  }

  return { tipo: 'complemento', motivo: `PIX pago em mês posterior (${data.slice(0, 7)}) ao mês de vencimento (${janela.mes_pagamento})`, naJanelaQuintoDia: false, gravadoComoValeNoQuintoDia: false };
}

export function situacaoRastreio({ liquido, pago, aConfirmar, vencimento, hoje, coberturaExtrato }) {
  const saldo = liquido - pago;
  if (saldo < -TOLERANCIA) return 'pago_a_maior';
  if (saldo <= TOLERANCIA) return 'quitada';
  if (aConfirmar > 0 && saldo - aConfirmar <= TOLERANCIA) return 'a_confirmar';
  if (coberturaExtrato === 'ausente' && pago === 0) return 'cobertura_insuficiente';
  if (vencimento && hoje <= vencimento) return pago > 0 ? 'parcial_a_vencer' : 'a_vencer';
  return pago > 0 ? 'parcial' : 'vencida';
}