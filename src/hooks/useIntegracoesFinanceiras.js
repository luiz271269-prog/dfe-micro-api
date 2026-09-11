import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function useIntegracoesFinanceiras() {
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const carregar = useCallback(async () => {
    const dados = await base44.entities.IntegracaoFinanceira.list('-ultima_sincronizacao', 5000);
    setRegistros(dados);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const sincronizar = async () => {
    setSincronizando(true); setMensagem('');
    const { data } = await base44.functions.invoke('sincronizarAppsFinanceiros', {});
    setMensagem(data.ok ? `Sincronização concluída: ${data.recebidos} novos, ${data.atualizados} atualizados e ${data.enviados} enviados.` : `Sincronização parcial: ${data.erros?.join(' · ') || data.error}`);
    await carregar(); setSincronizando(false);
  };
  const alterar = async (item, mudanca) => {
    await base44.entities.IntegracaoFinanceira.update(item.id, { ...mudanca, pendente_envio: true, erro_sync: '' });
    await carregar();
  };
  return { registros, carregando, sincronizando, mensagem, sincronizar, alterar };
}