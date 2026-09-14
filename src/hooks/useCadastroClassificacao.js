import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getItensCadastro } from '@/lib/classificacaoUnificada';

export default function useCadastroClassificacao(eixo, natureza) {
  const cadastro = useQuery({
    queryKey: ['cadastro-classificacao'],
    queryFn: () => base44.entities.CadastroClassificacao.list('ordem', 200),
    staleTime: 60000,
  });
  const usuario = useQuery({
    queryKey: ['usuario-atual'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000,
  });
  const itens = useMemo(
    () => getItensCadastro(cadastro.data || [], eixo, usuario.data?.role || 'user', natureza),
    [cadastro.data, eixo, natureza, usuario.data?.role]
  );
  const opcoes = useMemo(() => Object.fromEntries(itens.map(item => [item.chave, item.rotulo])), [itens]);
  return { itens, opcoes, isLoading: cadastro.isLoading || usuario.isLoading };
}