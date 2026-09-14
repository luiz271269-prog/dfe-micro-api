import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { revisarTiposGasto } from '@/functions/revisarTiposGasto';
import { CONTAS_PLANO, NATUREZAS_PLANO } from '@/lib/planoContasPadrao';

export default function useCadastroClassificacaoAdmin() {
  const queryClient = useQueryClient();
  const cadastro = useQuery({ queryKey: ['cadastro-classificacao'], queryFn: () => base44.entities.CadastroClassificacao.list('ordem', 200) });
  const usuario = useQuery({ queryKey: ['usuario-atual'], queryFn: () => base44.auth.me(), staleTime: 300000 });

  async function salvar(dados, id) {
    if (!id && (cadastro.data || []).some(item => item.eixo === dados.eixo && item.chave === dados.chave)) throw new Error('Já existe uma classificação com esta chave neste eixo.');
    const payload = { eixo: dados.eixo, chave: dados.chave, rotulo: dados.rotulo, natureza_vinculada: dados.natureza_vinculada || '', naturezas_vinculadas: dados.naturezas_vinculadas || [], centros_custo_vinculados: dados.centros_custo_vinculados || [], nivel: dados.nivel || 'base', ativo: dados.ativo !== false, perfis_permitidos: dados.perfis_permitidos || [], ordem: Number(dados.ordem || 0), cor: dados.cor || '' };
    if (id) await base44.entities.CadastroClassificacao.update(id, payload);
    else await base44.entities.CadastroClassificacao.create(payload);
    await queryClient.invalidateQueries({ queryKey: ['cadastro-classificacao'] });
  }

  async function auditar(alteracoes, execucaoId) {
    if (!alteracoes.length) return;
    await base44.entities.AuditoriaClassificacao.bulkCreate(alteracoes.map(item => ({ execucao_id: execucaoId, entidade_tipo: 'CadastroClassificacao', entidade_id: item.id || item.chave, origem_alteracao: 'manual', confianca: 100, motivos: ['sincronização manual do plano de contas'], antes_json: JSON.stringify(item.antes || {}), depois_json: JSON.stringify(item.depois || {}) })));
  }

  async function salvarLote(drafts) {
    const atuais = new Map((cadastro.data || []).map(item => [item.id, item]));
    const alteracoes = drafts.filter(item => JSON.stringify(item) !== JSON.stringify(atuais.get(item.id)));
    if (!alteracoes.length) return;
    await base44.entities.CadastroClassificacao.bulkUpdate(alteracoes.map(item => ({ id: item.id, rotulo: item.rotulo, natureza_vinculada: item.naturezas_vinculadas?.[0] || '', naturezas_vinculadas: item.naturezas_vinculadas || [], centros_custo_vinculados: item.centros_custo_vinculados || [], ativo: item.ativo })));
    await auditar(alteracoes.map(item => ({ id: item.id, antes: atuais.get(item.id), depois: item })), `plano-lote-${Date.now()}`);
    await queryClient.invalidateQueries({ queryKey: ['cadastro-classificacao'] });
  }

  async function sincronizarPlano() {
    const atuais = cadastro.data || [];
    const mapa = new Map(atuais.map(item => [`${item.eixo}|${item.chave}`, item]));
    const definicoes = [...NATUREZAS_PLANO, ...CONTAS_PLANO];
    const atualizar = definicoes.filter(item => mapa.has(`${item.eixo}|${item.chave}`)).map(item => ({ id: mapa.get(`${item.eixo}|${item.chave}`).id, ...item }));
    const criar = definicoes.filter(item => !mapa.has(`${item.eixo}|${item.chave}`)).map(item => ({ ...item, ativo: true, perfis_permitidos: ['admin', 'user'], naturezas_vinculadas: item.naturezas_vinculadas || [], centros_custo_vinculados: item.centros_custo_vinculados || [] }));
    if (atualizar.length) await base44.entities.CadastroClassificacao.bulkUpdate(atualizar);
    const criados = criar.length ? await base44.entities.CadastroClassificacao.bulkCreate(criar) : [];
    const execucaoId = `sincronizar-plano-${Date.now()}`;
    await auditar([...atualizar.map(item => ({ id: item.id, antes: atuais.find(x => x.id === item.id), depois: item })), ...criados.map(item => ({ id: item.id, antes: {}, depois: item }))], execucaoId);
    const validacao = await revisarTiposGasto({ action: 'aplicar_automatico', dry_run: false });
    await queryClient.invalidateQueries({ queryKey: ['cadastro-classificacao'] });
    return { atualizados: atualizar.length, criados: criar.length, validacao };
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
    salvarLote,
    sincronizarPlano,
    remover,
  };
}