import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function RodarPipelineButton({ onConcluido }) {
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const rodar = async () => {
    setRodando(true);
    setResultado(null);
    const { data } = await base44.functions.pipelineConciliacao({});
    setResultado(data);
    setRodando(false);
    onConcluido?.();
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button size="sm" variant="outline" onClick={rodar} disabled={rodando}>
        <RefreshCw className={`w-4 h-4 ${rodando ? 'animate-spin' : ''}`} />
        {rodando ? 'Conciliando…' : 'Aumentar cobertura'}
      </Button>
      {resultado && (
        <span className="text-xs text-muted-foreground">
          {resultado.auto_aprovadas ?? 0} novos vínculos · {resultado.sugestoes_pendentes ?? 0} sugestões avaliadas
        </span>
      )}
    </div>
  );
}