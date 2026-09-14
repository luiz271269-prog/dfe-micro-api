import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';

export default function useCadastroClassificacaoAdmin() {
  const queryClient = useQueryClient();
  const cadastro = useQuery({ queryKey: ['cadastro-classificacao'], queryFn: () => base44.entities.CadastroClassificacao.list('ordem', 200) });
  const usuario = useQuery({ queryKey: ['usuario-atual'], queryFn: () => base44.auth.me(), staleTime: 300000 });

  async function salvar(dados, id) {
    if (!id && (cadastro.data || []).some(item => item.eixo === dados.eixo && item.chave === dados.chave)) throw new Error('Já existe uma classificação com esta chave neste eixo.');
    const payload = { eixo: dados.eixo, chave: dados.chave, rotulo: dados.rotulo, natureza_vinculada: dados.natureza_vinculada || '', nivel: dados.nivel || 'base', ativo: dados.ativo !== false, perfis_permitidos: dados.perfis_permitidos || [], ordem: Number(dados.ordem || 0), cor: dados.cor || '' };
    if (id) await base44.entities.CadastroClassificacao.update(id, payload);
    else await base44.entities.CadastroClassificacao.create(payload);
    await revisarTiposGasto({ action: 'migrar_cadastro' });
    await queryClient.invalidateQueries({ queryKey: ['cadastro-classificacao'] });
  }

  async function remover(id) {
    await base44.entities.CadastroClassificacao.delete(id);
    await queryClient.invalidateQueries({ queryKey: ['cadastro-classificacao'] });
  }

  return {
    itens: cadastro.data || [],
    usuario: usuario.data,
    isLoading: cadastro.isLoading || usuario.isLoading,
    salvar,
    remover,
  };
}