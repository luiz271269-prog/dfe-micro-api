import { base44 } from '@/api/base44Client';
import { extrairTermoChave } from './autoCategorizacao';

// Categorias válidas em RegraRecorrente — o que não mapear vira 'outro'
const CATEGORIAS_RECORRENTE = ['aluguel', 'energia', 'agua', 'internet', 'telefone', 'software', 'contabilidade', 'seguro', 'manutencao', 'marketing', 'outro'];

/**
 * Aprende (ou atualiza) uma RegraRecorrente a partir de uma classificação manual.
 * Só cria regra quando o mesmo beneficiário aparece em ≥2 meses distintos no extrato —
 * assim o próximo mês já chega com a regra ativa e o valor esperado calibrado.
 */
export async function aprenderRecorrenciaDeClassificacao({ descricao, categoria, lancamentos = null }) {
  const termo = extrairTermoChave(descricao);
  if (!termo || termo.length < 3) return null;

  const todos = lancamentos || await base44.entities.LancamentoBancario.list('-data', 2000).catch(() => []);
  const ocorrencias = todos.filter(l => l.valor < 0 && extrairTermoChave(l.descricao) === termo);
  const meses = new Set(ocorrencias.map(l => (l.data || '').slice(0, 7)));
  if (meses.size < 2) return null;

  const valores = ocorrencias.map(l => Math.abs(l.valor));
  const media = Math.round(valores.reduce((a, b) => a + b, 0) / valores.length * 100) / 100;
  const maxDesvio = media > 0 ? Math.max(...valores.map(v => Math.abs(v - media) / media * 100)) : 0;
  const dias = ocorrencias.map(l => parseInt((l.data || '').slice(8, 10), 10)).filter(Boolean).sort((a, b) => a - b);
  const diaMediano = dias[Math.floor(dias.length / 2)] || 1;
  const ultima = ocorrencias.map(l => l.data).sort().pop();

  // Dados recalibrados a cada nova classificação
  const calibracao = {
    valor_esperado: media,
    tolerancia_percentual: Math.min(30, Math.max(5, Math.ceil(maxDesvio))),
    dia_vencimento: diaMediano,
    historico_valores: valores.slice(0, 24),
    ultima_ocorrencia: ultima,
    is_ativa: true,
  };

  const existentes = await base44.entities.RegraRecorrente.filter({ padrao_descricao: termo });
  if (existentes.length > 0) {
    // Atualiza calibração sem sobrescrever categoria/nome escolhidos manualmente
    await base44.entities.RegraRecorrente.update(existentes[0].id, calibracao);
    return { acao: 'atualizada', termo, ...calibracao };
  }

  await base44.entities.RegraRecorrente.create({
    nome: termo.slice(0, 40),
    padrao_descricao: termo,
    categoria: CATEGORIAS_RECORRENTE.includes(categoria) ? categoria : 'outro',
    observacoes: 'Aprendida automaticamente a partir de classificação manual',
    ...calibracao,
  });
  return { acao: 'criada', termo, ...calibracao };
}