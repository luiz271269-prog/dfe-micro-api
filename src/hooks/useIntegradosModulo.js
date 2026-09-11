import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { filtrarIntegradosModulo } from '@/lib/integracoesPorModulo';

export default function useIntegradosModulo(modulo) {
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const carregar = useCallback(async () => {
    const dados = await base44.entities.IntegracaoFinanceira.list('-data_referencia', 5000);
    setRegistros(filtrarIntegradosModulo(dados, modulo));
    setCarregando(false);
  }, [modulo]);
  useEffect(() => {
    carregar();
    const cancelar = base44.entities.IntegracaoFinanceira.subscribe(carregar);
    return cancelar;
  }, [carregar]);
  return { registros, carregando };
}