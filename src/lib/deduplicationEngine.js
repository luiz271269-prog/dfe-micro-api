import { base44 } from '@/api/base44Client';

/**
 * Motor de deduplicação genérico e reutilizável
 * Funciona como pilar mestre para QUALQUER tipo de importação
 */

// ─────────────────────────────────────────────────────────────────────
// Helpers para chave canônica de TituloCobranca.
// Mesma lógica replicada em functions/deduplicarTitulosCobranca e
// functions/deduplicarImportacoes — mantenha as três em sincronia.
// ─────────────────────────────────────────────────────────────────────
function extractNFCIRef(value) {
  if (!value) return null;
  const s = String(value).toUpperCase().trim();
  const m = s.match(/(NF|CI)[\s\-]*0*(\d+)/);
  if (m) return `${m[1]}-${m[2]}`;
  const num = s.match(/^0*(\d+)(?:[\/\-]\d+)?$/);
  if (num) return `NF-${num[1]}`;
  return null;
}

function extractParcelaFromNosso(nossoNum) {
  if (!nossoNum) return null;
  const m = String(nossoNum).match(/[\/\-](\d+)$/);
  return m ? parseInt(m[1]) : null;
}

function normalizeClienteTitulo(c) {
  return (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25);
}

// Chave canônica: prioriza NF+parcela; fallback cliente+vencimento+valor
function tituloCobrancaKey(r) {
  const nfRef = extractNFCIRef(r.seu_numero) || extractNFCIRef(r.nosso_numero);
  const parcela = r.parcela_numero || extractParcelaFromNosso(r.nosso_numero);
  if (nfRef && parcela) return `nf:${nfRef}|p:${parcela}`;
  if (r.cliente && r.data_vencimento && r.valor_titulo != null) {
    return `cli:${normalizeClienteTitulo(r.cliente)}|v:${r.data_vencimento}|val:${Math.round(Number(r.valor_titulo) * 100)}`;
  }
  return null;
}

function lancamentoBancarioKey(r) {
  const text = `${r.descricao || ''} ${r.detalhe || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const contract = text.match(/C\s*(\d{8,})/);
  if (contract && /OPERACAO DE CREDITO|LIQUIDACAO DE PARCELA|PARCELA/.test(text)) {
    return `fin:${String(r.data || '').slice(0, 7)}|c:${contract[1].slice(0, 8)}|v:${Math.round(Number(r.valor || 0) * 100)}`;
  }
  const description = (r.descricao || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30);
  return `${r.data}|${Number(r.valor).toFixed(2)}|${description}`;
}

const DEDUP_CONFIG = {
  LancamentoBancario: {
    entity: 'LancamentoBancario',
    keyBuilder: lancamentoBancarioKey,
  },
  NotaFiscal: {
    entity: 'NotaFiscal',
    keys: ['numero'], // apenas número — NF e NFe com mesmo número são a mesma nota (contabilidade vs Fabris)
  },
  TituloCobranca: {
    entity: 'TituloCobranca',
    keyBuilder: tituloCobrancaKey, // chave canônica (NF+parcela ou fallback cliente+venc+valor)
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
    // Normaliza estabelecimento de forma agressiva (uppercase + sem pontuação) para tolerar
    // variações de extração ("MP*UBER", "MP *UBER", "mp*uber") como o mesmo lançamento.
    normalizers: {
      estabelecimento: v => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30),
    },
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
 * normalizers (opcional): { campo: fn(valor) => string } — sobrescreve normalizeValue para o campo
 */
function createDedupKey(record, keys, normalizers, keyBuilder) {
  if (keyBuilder) return keyBuilder(record) || '';
  return keys
    .map(k => {
      const val = record[k];
      if (normalizers && normalizers[k]) return normalizers[k](val);
      return normalizeValue(val);
    })
    .join('|');
}

/**
 * Valida se um registro é válido para deduplicação
 */
function isValidRecord(record, keys, keyBuilder) {
  if (keyBuilder) return !!keyBuilder(record);
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

  const { entity, keys, normalizers, keyBuilder } = config;
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
      .filter(r => isValidRecord(r, keys, keyBuilder))
      .map(r => createDedupKey(r, keys, normalizers, keyBuilder))
  );

  // Processar cada registro
  for (const record of records) {
    let status = 'novo';

    // Validação básica
    if (!isValidRecord(record, keys, keyBuilder)) {
      status = 'erro';
    } else {
      const batchKey = createDedupKey(record, keys, normalizers, keyBuilder);

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