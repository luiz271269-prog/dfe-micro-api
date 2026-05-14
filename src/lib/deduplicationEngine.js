import { base44 } from '@/api/base44Client';

/**
 * Motor de deduplicação genérico e reutilizável
 * Funciona como pilar mestre para QUALQUER tipo de importação
 */

const DEDUP_CONFIG = {
  LancamentoBancario: {
    entity: 'LancamentoBancario',
    keys: ['data', 'valor', 'conta_bancaria'],
  },
  NotaFiscal: {
    entity: 'NotaFiscal',
    keys: ['numero'], // apenas número — NF e NFe com mesmo número são a mesma nota (contabilidade vs Fabris)
  },
  TituloCobranca: {
    entity: 'TituloCobranca',
    keys: ['nosso_numero'],
  },
  ItemCompra: {
    entity: 'ItemCompra',
    keys: ['fornecedor', 'numero_nota', 'descricao_produto'],
  },
  FaturaCartao: {
    entity: 'FaturaCartao',
    keys: ['conta_cartao_id', 'mes_referencia'],
  },
  LancamentoCartao: {
    entity: 'LancamentoCartao',
    keys: ['fatura_id', 'data_lancamento', 'estabelecimento', 'valor'],
  },
  ObraReforma: {
    entity: 'ObraReforma',
    keys: ['data', 'responsavel', 'valor'],
  },
  FolhaPagamento: {
    entity: 'FolhaPagamento',
    keys: ['funcionario_nome', 'competencia'],
  },
  Tributo: {
    entity: 'Tributo',
    keys: ['tipo', 'competencia', 'empresa'],
  },
  RelatorioFaturamento: {
    entity: 'RelatorioFaturamento',
    keys: ['mes'],
  },
  ConciliacaoItem: {
    entity: 'ConciliacaoItem',
    keys: ['mes_referencia', 'data_extrato', 'desc_extrato', 'valor_extrato'],
  },
  DespesaOperacional: {
    entity: 'DespesaOperacional',
    keys: ['data', 'descricao', 'valor'],
  },
};

/**
 * Normaliza um valor para comparação (remover espaços, case-insensitive para strings)
 */
function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number') return value.toFixed(2); // evita 850 vs 850.00
  return String(value).trim().toLowerCase();
}

/**
 * Cria uma chave de deduplicação para um registro
 */
function createDedupKey(record, keys) {
  return keys
    .map(k => {
      const val = record[k];
      return normalizeValue(val);
    })
    .join('|');
}

/**
 * Valida se um registro é válido para deduplicação
 */
function isValidRecord(record, keys) {
  return keys.some(k => record[k] != null && record[k] !== '');
}

/**
 * Deduplicação genérica: recebe registros e retorna array com status de dedup
 * @param {Array} records - Registros a processar
 * @param {String} entityType - Tipo de entidade (chave em DEDUP_CONFIG)
 * @returns {Promise<Array>} Array de {data, status: 'novo'|'duplicata'|'erro', selected}
 */
export async function deduplicateRecords(records, entityType) {
  const config = DEDUP_CONFIG[entityType];
  if (!config) {
    throw new Error(`Configuração de deduplicação não encontrada para ${entityType}`);
  }

  const { entity, keys } = config;
  const seenInBatch = new Set();
  const enriched = [];

  // Buscar TODOS os registros existentes para evitar duplicatas em importações de meses antigos
  // (200 era insuficiente quando o histórico já passa de 200 lançamentos)
  let existingRecords = [];
  try {
    existingRecords = await base44.entities[entity].list('-created_date', 10000);
  } catch {
    // Se falhar, continua sem validar duplicatas no banco
  }

  // Criar set de chaves existentes no banco
  const existingKeys = new Set(
    existingRecords
      .filter(r => isValidRecord(r, keys))
      .map(r => createDedupKey(r, keys))
  );

  // Processar cada registro
  for (const record of records) {
    let status = 'novo';

    // Validação básica
    if (!isValidRecord(record, keys)) {
      status = 'erro';
    } else {
      const batchKey = createDedupKey(record, keys);

      // Verificar se já foi visto neste batch
      if (seenInBatch.has(batchKey)) {
        status = 'duplicata';
      } else {
        seenInBatch.add(batchKey);

        // Verificar se existe no banco
        if (existingKeys.has(batchKey)) {
          status = 'duplicata';
        }
      }
    }

    enriched.push({
      data: record,
      status,
      selected: status === 'novo',
    });
  }

  return enriched;
}

/**
 * Salva registros após passar pela deduplicação
 * Retorna estatísticas de sucesso
 */
export async function saveDeduplicatedRecords(entityType, recordsWithStatus) {
  const config = DEDUP_CONFIG[entityType];
  if (!config) {
    throw new Error(`Configuração de deduplicação não encontrada para ${entityType}`);
  }

  const { entity } = config;
  // Respeita seleção explícita do usuário — salva tudo que está marcado (inclusive 'erro' se usuário confirmou)
  const toSave = recordsWithStatus.filter(r => r.selected);

  // Salvar em paralelo (lotes de 5) para maior velocidade
  let saved = 0;
  let errors = 0;
  const BATCH = 5;

  for (let i = 0; i < toSave.length; i += BATCH) {
    const chunk = toSave.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      chunk.map(record => base44.entities[entity].create(record.data))
    );
    results.forEach(r => { if (r.status === 'fulfilled') saved++; else errors++; });
  }

  return {
    saved,
    errors,
    duplicates: recordsWithStatus.filter(r => r.status === 'duplicata').length,
    invalid: recordsWithStatus.filter(r => r.status === 'erro').length,
  };
}

export default {
  DEDUP_CONFIG,
  deduplicateRecords,
  saveDeduplicatedRecords,
};