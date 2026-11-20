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
  // motivo informado = baixa manual (parcela e crédito fora das sugestões)
  const confirmar = (linha, tituloId, creditoId, motivo) => gerenciarEvidenciasFinanceiras({
    acao: 'confirmar', evidencia_id: linha.id, entidade_id: tituloId, lancamento_bancario_id: creditoId, manual: !!motivo,
    motivo: motivo || `Conciliação de recebimentos: boleto liquidado em ${linha.data}, parcela e crédito bancário conferidos pelo usuário.`,
  });
  const receberPix = (pix, titulo, motivo) => gerenciarEvidenciasFinanceiras({
    acao: 'confirmar_credito', entidade_id: titulo.id, lancamento_bancario_id: pix.id, manual: !!motivo, motivo,
  });
  return { query, atualizar, confirmar, receberPix };
}