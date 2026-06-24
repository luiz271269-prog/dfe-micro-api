import { base44 } from '@/api/base44Client';

// Normaliza texto: lowercase, sem acentos, sem dígitos longos / códigos / CPF/CNPJ / pontuação.
// Mantém apenas os "tokens nominais" — geralmente o estabelecimento ou beneficiário.
export function extrairTermoChave(texto) {
  if (!texto) return '';
  let s = texto
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos

  // remove códigos longos (CPF, CNPJ, nosso número, contas, etc — 8+ dígitos)
  s = s.replace(/\b\d{8,}\b/g, ' ');
  // remove prefixos comuns de extrato bancário
  s = s.replace(/\b(pix[\s_-]?(cred|deb)?|ted|doc|pagto|pgto|recebimento|pagamento|transf|transferencia|cob\d+|cobranca)\b/g, ' ');
  // remove pontuação e caracteres não alfa
  s = s.replace(/[^a-z\s]/g, ' ');
  // colapsa espaços
  s = s.replace(/\s+/g, ' ').trim();

  // pega até as 4 primeiras palavras significativas (mín. 3 letras)
  const tokens = s.split(' ').filter(t => t.length >= 3).slice(0, 4);
  return tokens.join(' ');
}

/**
 * Salva/atualiza uma regra de categorização e aplica retroativamente aos
 * lançamentos similares que ainda estão na categoria padrão.
 *
 * @param {object} opts
 * @param {'extrato'|'cartao'} opts.escopo
 * @param {string} opts.descricao - descrição/estabelecimento do lançamento classificado
 * @param {string} opts.categoria - nova categoria escolhida
 * @param {string[]} [opts.categoriasPadraoSubstituiveis] - categorias consideradas "não-classificadas" que podem ser sobrescritas
 * @returns {Promise<{termo_chave: string, aplicados: number}>}
 */
export async function aprenderEAplicarRegra({ escopo, descricao, categoria, categoriasPadraoSubstituiveis = [] }) {
  const termo = extrairTermoChave(descricao);
  if (!termo || termo.length < 3) return { termo_chave: '', aplicados: 0 };

  // 1. Upsert da regra
  const existentes = await base44.entities.RegraCategorizacao.filter({ escopo, termo_chave: termo });
  if (existentes.length > 0) {
    const r = existentes[0];
    await base44.entities.RegraCategorizacao.update(r.id, {
      categoria,
      exemplo_descricao: descricao,
      vezes_aplicada: (r.vezes_aplicada || 1) + 1,
      ultima_atualizacao: new Date().toISOString(),
    });
  } else {
    await base44.entities.RegraCategorizacao.create({
      escopo,
      termo_chave: termo,
      categoria,
      exemplo_descricao: descricao,
      vezes_aplicada: 1,
      ultima_atualizacao: new Date().toISOString(),
    });
  }

  // 2. Aplica retroativamente: busca todos com o mesmo termo que estão em categoria padrão
  const entityName = escopo === 'cartao' ? 'LancamentoCartao' : 'LancamentoBancario';
  const campoDesc = escopo === 'cartao' ? 'estabelecimento' : 'descricao';

  // Carrega tudo (limite alto) e filtra em memória — termo_chave é normalizado
  const todos = await base44.entities[entityName].list('-data', 2000).catch(() => []);
  const alvo = todos.filter(l => {
    if (l.categoria === categoria) return false;
    if (categoriasPadraoSubstituiveis.length > 0 && !categoriasPadraoSubstituiveis.includes(l.categoria)) return false;
    const desc = escopo === 'cartao' ? l.estabelecimento : l.descricao;
    return extrairTermoChave(desc) === termo;
  });

  let aplicados = 0;
  for (const l of alvo) {
    try {
      await base44.entities[entityName].update(l.id, { categoria });
      aplicados++;
    } catch (e) { /* ignora item individual */ }
  }

  return { termo_chave: termo, aplicados };
}

/**
 * Sugere uma categoria com base em regras já aprendidas, para um lançamento ainda não classificado.
 * Retorna null se não houver regra correspondente.
 */
export async function sugerirCategoria({ escopo, descricao }) {
  const termo = extrairTermoChave(descricao);
  if (!termo) return null;
  const regras = await base44.entities.RegraCategorizacao.filter({ escopo, termo_chave: termo });
  return regras[0]?.categoria || null;
}