import { arred } from './evidencia.ts';

export function diagnosticarCachesConciliacao(lancamentos, vinculos) {
  const porLancamento = new Map();
  for (const vinculo of vinculos) {
    const atual = porLancamento.get(vinculo.lancamento_bancario_id) || { count: 0, valor: 0 };
    atual.count += 1;
    atual.valor += Number(vinculo.valor_alocado) || 0;
    porLancamento.set(vinculo.lancamento_bancario_id, atual);
  }

  const correcoes = [];
  for (const lancamento of lancamentos) {
    const real = porLancamento.get(lancamento.id) || { count: 0, valor: 0 };
    const valor = arred(real.valor);
    let status = real.count ? (valor >= Math.abs(lancamento.valor || 0) - 0.5 ? 'conciliado' : 'parcial') : 'nao_conciliado';
    if (lancamento.status_conciliacao === 'ignorar') status = 'ignorar';
    if ((lancamento.vinculos_count || 0) !== real.count || Math.abs((lancamento.valor_conciliado || 0) - valor) > 0.01 || lancamento.status_conciliacao !== status) {
      correcoes.push({ id: lancamento.id, status_conciliacao: status, vinculos_count: real.count, valor_conciliado: valor });
    }
  }

  return { divergencias: correcoes.length, correcoes, fonte: 'VinculoExtrato' };
}