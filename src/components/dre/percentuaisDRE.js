const CUSTOS = ['cmv', 'das', 'folha', 'prolabore', 'despesas', 'obras', 'outros_tributos', 'total_despesas_operacionais'];

export function tipoPercentualDRE(campo) {
  if (CUSTOS.includes(campo)) return 'custo';
  if (campo === 'receita_bruta') return 'receita';
  if (campo === 'lucro_bruto') return 'liquida';
  return null;
}

export function percentuaisDRE(valor, base, tipo) {
  if (!base || !tipo) return [];
  const liquida = Math.round((base.receita_bruta - base.das - base.cmv) * 100) / 100;
  const razao = denominador => Number.isFinite(valor) && Number.isFinite(denominador) && denominador !== 0 ? valor / denominador * 100 : null;
  if (tipo === 'custo') return [
    { chave: 'bruta', label: 'da receita bruta', valor: razao(base.receita_bruta) },
    { chave: 'lucro', label: 'do lucro operacional', valor: razao(base.lucro_operacional) },
  ];
  if (tipo === 'receita') return [{ chave: 'liquida', label: 'da receita líquida', valor: razao(liquida) }];
  return [{ chave: 'lucro', label: 'do lucro operacional', valor: razao(base.lucro_operacional) }];
}

export const formatarPercentualDRE = valor => valor === null ? '—' : `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;