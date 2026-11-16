import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Ids dos cadastros de despesa fixa marcados como "Eventual".
export default function useRegrasEventuais() {
  const { data } = useQuery({
    queryKey: ['regras-eventuais'],
    queryFn: () => base44.entities.RegraRecorrente.filter({ tipo_recorrencia: 'eventual' }, '-created_date', 500),
  });
  return useMemo(() => new Set((data || []).map(r => r.id)), [data]);
}