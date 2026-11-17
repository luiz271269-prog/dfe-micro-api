import { useQuery } from '@tanstack/react-query';
import { consolidarDREOperacional } from '@/functions/consolidarDREOperacional';

export const ROTULO_LINHA_DRE = {
  receita_bruta: 'Receita Bruta', cmv: 'CMV', das: 'DAS', folha: 'Folha',
  despesas: 'Despesas adm./oper.', outros_tributos: 'Outros tributos',
  prolabore: 'Pró-labore', obras: 'Obras e reformas', fora: 'Fora da DRE',
};

// Mesma consulta para painel e tabela (react-query deduplica pela chave)
export function useDREExtrato(mes, isAnnual) {
  const modo = isAnnual ? 'ano_civil' : 'mensal';
  return useQuery({
    queryKey: ['comparativo-dre', mes, modo],
    queryFn: async () => (await consolidarDREOperacional({ mes_referencia: mes, modo_periodo: modo, incluir_mapa_extrato: true })).data,
  });
}

export const linhaDREDe = (mapa, id) => mapa?.[id]?.[0] || 'fora';