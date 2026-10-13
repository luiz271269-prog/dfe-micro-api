import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sincronizarAppsFinanceiros } from '@/functions/sincronizarAppsFinanceiros';

export default function useIntegracoesFinanceiras() {
  const client = useQueryClient();
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const atualizar = () => client.invalidateQueries({ queryKey: ['integracoes-direcao'] });
  const sincronizar = async () => {
    setSincronizando(true); setMensagem('');
    try {
      const { data } = await sincronizarAppsFinanceiros({});
      setMensagem(data.ok ? `Sincronização: ${data.recebidos} novos, ${data.atualizados} alterados e ${data.enviados} enviados.` : `Sincronização parcial: ${data.erros?.join(' · ') || data.error}`);
      await atualizar();
      window.dispatchEvent(new Event('neuralfinRefresh'));
    } catch (error) { setMensagem(error.response?.data?.error || error.message); }
    finally { setSincronizando(false); }
  };
  const alterar = async (item, mudanca) => {
    await base44.entities.IntegracaoFinanceira.update(item.id, { ...mudanca, pendente_envio: true, erro_sync: '' });
    await atualizar();
  };
  return { sincronizando, mensagem, sincronizar, alterar };
}