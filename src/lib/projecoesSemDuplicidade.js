// Somente apresentação: não apaga nem reescreve projeções ou pagamentos históricos.
export default function projecoesSemDuplicidade(persistidos, automaticos, componentesCartao) {
  const representados = new Set(automaticos.map(f => f.origem_id).filter(Boolean));
  return [...persistidos.filter(f => !(['previsto', 'confirmado', 'vencido'].includes(f.status) && f.origem_id && (representados.has(f.origem_id) || componentesCartao.has(f.origem_id)))), ...automaticos];
}