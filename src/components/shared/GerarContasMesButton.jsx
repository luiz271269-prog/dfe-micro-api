import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { gerarContasMensais } from '@/functions/gerarContasMensais';
import { getCurrentMonth } from '@/lib/currentMonth';

// Mesma rotina do dia 1º: despesas fixas do mês + previsão de DAS. FGTS/INSS vêm da folha.
export default function GerarContasMesButton({ onDone, disabled }) {
  const [rodando, setRodando] = useState(false);
  const { toast } = useToast();
  async function gerar() {
    setRodando(true);
    const res = await gerarContasMensais({ competencia: getCurrentMonth() }).catch(e => ({ data: { error: e.response?.data?.error || e.message } }));
    setRodando(false);
    const d = res.data || {};
    if (d.error) return toast({ title: 'Não foi possível gerar', description: d.error, variant: 'destructive' });
    const das = (d.das || []).filter(x => x.situacao === 'previsão gerada').length;
    toast({ title: 'Contas do mês geradas', description: `${d.despesas_geradas} despesa(s) fixa(s) e ${das} previsão(ões) de DAS. Nenhum pagamento foi registrado.` });
    onDone?.();
  }
  return <Button variant="outline" className="gap-2" disabled={disabled || rodando} onClick={gerar}>
    <CalendarPlus className="w-4 h-4" /> {rodando ? 'Gerando...' : 'Gerar contas do mês'}
  </Button>;
}