import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gerenciarEvidenciasFinanceiras } from '@/functions/gerenciarEvidenciasFinanceiras';

// Fonte única da conciliação de recebimentos (boleto liquidado × parcela × crédito do extrato)
export default function useConciliacaoRecebimentos(arquivoHash) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['conciliacao-recebimentos', arquivoHash || 'todos'],
    queryFn: async () => (await gerenciarEvidenciasFinanceiras({ acao: 'painel', arquivo_hash: arquivoHash || '' })).data,
  });
  const { refetch } = query;
  useEffect(() => {
    const recarregar = () => refetch();
    window.addEventListener('neuralfinRefresh', recarregar);
    return () => window.removeEventListener('neuralfinRefresh', recarregar);
  }, [refetch]);
  const atualizar = () => {
    client.invalidateQueries({ queryKey: ['evidencias-financeiras'] });
    client.invalidateQueries({ queryKey: ['evidencias-totais'] });
    window.dispatchEvent(new Event('neuralfinRefresh'));
  };
  const confirmar = (linha, tituloId, creditoId) => gerenciarEvidenciasFinanceiras({
    acao: 'confirmar', evidencia_id: linha.id, entidade_id: tituloId, lancamento_bancario_id: creditoId,
    motivo: `Conciliação de recebimentos: boleto liquidado em ${linha.data}, parcela e crédito bancário conferidos pelo usuário.`,
  });
  return { query, atualizar, confirmar };
}