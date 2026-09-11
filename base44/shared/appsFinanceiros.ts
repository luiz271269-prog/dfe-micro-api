import { secrets } from 'base44:runtime';

const configs = {
  locacoes: {
    id: '6a25a35e924aa1d5d5b267a8',
    key: () => secrets.get('LOCACOES_API_KEY'),
    entidades: [
      { nome: 'ContratoLocacao', tipo: 'contrato_locacao' },
      { nome: 'ContaPagar', tipo: 'despesa_condominio' },
    ],
  },
  assistencia: {
    id: '6a99501194d7ef9d01a9fd11',
    key: () => secrets.get('ASSISTENCIA_API_KEY'),
    entidades: [
      { nome: 'ServiceOrder', tipo: 'ordem_servico' },
      { nome: 'Invoice', tipo: 'recebimento_servico' },
    ],
  },
};

const baseUrl = config => `https://app.base44.com/api/apps/${config.id}/entities`;
const headers = config => ({ api_key: config.key(), 'Content-Type': 'application/json' });

export function getAppsFinanceiros() {
  return configs;
}

export async function listarRegistrosExternos(config, entidade) {
  const res = await fetch(`${baseUrl(config)}/${entidade}?limit=500`, { headers: headers(config) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`${entidade}: HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.results || json.data || []);
}

export async function atualizarRegistroExterno(config, entidade, id, data) {
  const res = await fetch(`${baseUrl(config)}/${entidade}/${id}`, { method: 'PUT', headers: headers(config), body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`${entidade}/${id}: HTTP ${res.status}`);
  return await res.json();
}

export function primeiroCampo(registro, nomes) {
  return nomes.find(nome => registro[nome] !== undefined && registro[nome] !== null) || '';
}

export function normalizarRegistro(app, entidade, tipo, registro) {
  const campoValor = primeiroCampo(registro, ['valor_aluguel','valor_total','total_amount','amount','value','valor','total']);
  const campoStatus = primeiroCampo(registro, ['status','payment_status','invoice_status','situacao']);
  const descricaoCampo = primeiroCampo(registro, ['descricao','description','title','numero','number','unidade_numero','service_type']);
  const contraparteCampo = primeiroCampo(registro, ['inquilino_nome','cliente_nome','customer_name','client_name','fornecedor','provider_name','morador_nome']);
  const referenciaCampo = primeiroCampo(registro, ['data_inicio','data_emissao','issue_date','service_date','date','created_date']);
  const vencimentoCampo = primeiroCampo(registro, ['data_vencimento','due_date','data_fim']);
  return {
    app_origem: app,
    entidade_externa: entidade,
    registro_externo_id: registro.id,
    tipo_registro: tipo,
    descricao: String(registro[descricaoCampo] || `${entidade} ${registro.id || ''}`).trim(),
    contraparte: String(registro[contraparteCampo] || '').trim(),
    data_referencia: String(registro[referenciaCampo] || '').slice(0, 10) || null,
    data_vencimento: String(registro[vencimentoCampo] || '').slice(0, 10) || null,
    valor: campoValor ? Number(registro[campoValor] || 0) : 0,
    status: campoStatus ? String(registro[campoStatus] || '') : '',
    campo_valor: campoValor,
    campo_status: campoStatus,
    payload_json: JSON.stringify(registro),
    external_updated_date: registro.updated_date || null,
    ultima_sincronizacao: new Date().toISOString(),
    pendente_envio: false,
    erro_sync: '',
  };
}