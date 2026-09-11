import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { sincronizarAppsFinanceiros } from '@/functions/sincronizarAppsFinanceiros';

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
    const { data } = await sincronizarAppsFinanceiros({});
    setMensagem(data.ok ? `Loop-R concluído: ${data.recebidos} novos, ${data.atualizados} alterados, ${data.ignorados || 0} sem mudança e ${data.enviados} enviados.` : `Sincronização parcial: ${data.erros?.join(' · ') || data.error}`);
    await carregar(); setSincronizando(false);
  };
  const alterar = async (item, mudanca) => {
    await base44.entities.IntegracaoFinanceira.update(item.id, { ...mudanca, pendente_envio: true, erro_sync: '' });
    await carregar();
  };
  return { registros, carregando, sincronizando, mensagem, sincronizar, alterar };
}