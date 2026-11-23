import { useState, useCallback } from 'react';
import { auditarVinculosNFBoletos } from '@/functions/auditarVinculosNFBoletos';

export default function useAuditoriaVinculos() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const executar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const resp = await auditarVinculosNFBoletos({});
      setDados(resp.data || resp);
    } catch (e) {
      setErro(e.response?.data?.error || e.message || 'Não foi possível executar a auditoria.');
    } finally {
      setCarregando(false);
    }
  }, []);

  const atualizar = useCallback(() => {
    if (dados) executar();
  }, [dados, executar]);

  return { dados, carregando, erro, executar, atualizar };
}