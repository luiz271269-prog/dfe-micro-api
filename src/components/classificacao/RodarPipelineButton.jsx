import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { pipelineConciliacao } from '@/functions/pipelineConciliacao';

export default function RodarPipelineButton({ onConcluido }) {
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);

  const rodar = async () => {
    setRodando(true);
    setResultado(null);
    setErro(null);
    try {
      const r = await pipelineConciliacao({});
      setResultado(r?.data || r);
      if (onConcluido) await onConcluido();
    } catch (e) {
      setErro(e?.response?.data?.error || e?.message || 'Falha ao conciliar');
    }
    setRodando(false);
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
      {erro && <span className="text-xs text-destructive">{erro}</span>}
    </div>
  );
}