export function calcularMediaVariaveis(folhas, funcionario, dataDesligamento) {
  if (!funcionario || !dataDesligamento) return { media: 0, meses: 0 };
  const competenciaLimite = dataDesligamento.slice(0, 7);
  const historico = (folhas || [])
    .filter((f) => (f.funcionario_id === funcionario.id || f.funcionario_nome === funcionario.nome) && (f.tipo || 'mensal') === 'mensal' && f.competencia <= competenciaLimite)
    .sort((a, b) => b.competencia.localeCompare(a.competencia))
    .slice(0, 12);
  const total = historico.reduce((s, f) => s + (f.comissao || 0) + (f.horas_extras || 0), 0);
  return { media: historico.length ? total / historico.length : 0, meses: historico.length };
}

export function calcularDeficitBancoHoras(lancamentos, funcionario, dataDesligamento, remuneracaoBase) {
  if (!funcionario) return { saldo: 0, horasDeficit: 0, desconto: 0 };
  const saldo = (lancamentos || [])
    .filter((l) => (l.funcionario_id === funcionario.id || l.funcionario_nome === funcionario.nome) && (!dataDesligamento || l.data <= dataDesligamento))
    .reduce((s, l) => s + (l.tipo === 'credito' ? (l.horas || 0) : -(l.horas || 0)), 0);
  const horasDeficit = Math.max(0, -saldo);
  return { saldo, horasDeficit, desconto: horasDeficit * ((remuneracaoBase || 0) / 220) };
}