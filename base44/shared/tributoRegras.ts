import { centavos, normConciliacao } from './conciliacaoLeitura.ts';
export const TIPOS_MENSAIS = ['DAS', 'FGTS', 'INSS'];
export function deslocarCompetencia(mes, delta = -1) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) throw new Error('Competência inválida.');
  const [ano, numero] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, numero - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function tipoTributo(texto) {
  const t = normConciliacao(texto);
  if (/\bfgts\b/.test(t)) return 'FGTS';
  if (/\binss\b|\bgps\b/.test(t)) return 'INSS';
  if (/\bdas\b|simples nacional/.test(t)) return 'DAS';
  return ['DARF','ICMS','ISS','IPTU','PIS','COFINS','IRPJ','CSLL'].find(x => new RegExp(`\\b${x.toLowerCase()}\\b`).test(t)) || null;
}
export function empresaExtrato(lanc) {
  const conta = normConciliacao(lanc.conta_bancaria);
  const empresas = [];
  if (/\bliesch\b|\b37101\b/.test(conta)) empresas.push('Liesch');
  if (/\bneuraltec\b|\b36092\b/.test(conta)) empresas.push('NeuralTec');
  return empresas.length === 1 ? empresas[0] : null;
}
export function ehPagamentoTributo(lanc) {
  return Number(lanc.valor) < 0 && !['transferencia','interno'].includes(lanc.categoria) && (lanc.categoria === 'tributo' || lanc.tipo_compra === 'impostos' || (!lanc.tipo_compra && !['fornecedor','pessoal','pro_labore','despesa_operacional','financeiro'].includes(lanc.categoria) && !!tipoTributo(`${lanc.descricao || ''} ${lanc.detalhe || ''}`)));
}
export function competenciaExtrato(lanc) {
  const texto = `${lanc.descricao || ''} ${lanc.detalhe || ''}`;
  const ref = texto.match(/(?:compet[eê]ncia|ref(?:er[eê]ncia)?)[\s.:/-]*(?:(\d{4})[-/](0[1-9]|1[0-2])|(0[1-9]|1[0-2])[-/](\d{4}))/i);
  if (ref) return { competencia: ref[1] ? `${ref[1]}-${ref[2]}` : `${ref[4]}-${ref[3]}`, explicita: true };
  const tipo = tipoTributo(texto);
  return { competencia: TIPOS_MENSAIS.includes(tipo) && lanc.data ? deslocarCompetencia(lanc.data.slice(0,7)) : null, explicita: false };
}
export const devidoTributo = t => Math.max(0, (centavos(t.valor_original) + centavos(t.juros_multa)) / 100);
export const saldoTributo = t => Math.max(0, (centavos(devidoTributo(t)) - centavos(t.valor_pago)) / 100);
export function correspondeTributo(lanc, tributo) {
  if (!ehPagamentoTributo(lanc) || ['conciliado','ignorar'].includes(lanc.status_conciliacao) || tributo.status === 'pago' || saldoTributo(tributo) <= 0) return false;
  if (empresaExtrato(lanc) !== tributo.empresa || !empresaExtrato(lanc)) return false;
  const tipo = tipoTributo(`${lanc.descricao || ''} ${lanc.detalhe || ''}`);
  const destino = tributo.tipo === 'GPS' ? 'INSS' : tributo.tipo;
  if (tipo && tipo !== destino) return false;
  const ref = competenciaExtrato(lanc);
  if (ref.explicita && ref.competencia !== tributo.competencia) return false;
  const dias = Math.abs(Date.parse(`${lanc.data}T12:00:00Z`) - Date.parse(`${tributo.data_vencimento}T12:00:00Z`)) / 86400000;
  return Number.isFinite(dias) && dias <= 15 && Math.abs(centavos(saldoTributo(tributo)) - centavos(Math.abs(lanc.valor))) <= 1;
}