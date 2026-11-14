import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sugestaoCorrecao } from '@/lib/naturezaCreditoExtrato';

export default function CorrigirNaturezaButton({ lancamentos, rotuloCategoria, onDone }) {
  const [rodando, setRodando] = useState(false);

  async function corrigir() {
    const alvos = lancamentos.map(l => ({ l, s: sugestaoCorrecao(l, rotuloCategoria) })).filter(x => x.s);
    const cont = { receita: 0, aplicacao: 0, resgate: 0, transferencia: 0 };
    alvos.forEach(x => { cont[x.s.natureza] += 1; });
    if (!alvos.length) { onDone?.({ total: 0 }); return; }
    if (!confirm(`Correções encontradas:\n• ${cont.receita} recebimento(s) → 1.01 Recebimentos\n• ${cont.aplicacao} aplicação(ões) → 8.02 Aplicações\n• ${cont.resgate} resgate(s) → 8.03 Resgates\n• ${cont.transferencia} transferência(s) → 8.01 Transferências internas\n\nLançamentos sem evidência clara não serão alterados. Aplicar?`)) return;
    setRodando(true);
    const execucao_id = `natureza-extrato-${Date.now()}`;
    for (let i = 0; i < alvos.length; i += 100) {
      const lote = alvos.slice(i, i + 100);
      await base44.entities.LancamentoBancario.bulkUpdate(lote.map(({ l, s }) => ({ id: l.id, categoria: s.categoria, origem_compra: s.origem_compra, tipo_compra: s.tipo_compra })));
      await base44.entities.AuditoriaClassificacao.bulkCreate(lote.map(({ l, s }) => ({
        execucao_id, entidade_tipo: 'LancamentoBancario', entidade_id: l.id, origem_alteracao: 'automatica', confianca: 90, motivos: [s.motivo],
        antes_json: JSON.stringify({ categoria: l.categoria, origem_compra: l.origem_compra, tipo_compra: l.tipo_compra }),
        depois_json: JSON.stringify({ categoria: s.categoria, origem_compra: s.origem_compra, tipo_compra: s.tipo_compra }),
      })));
    }
    setRodando(false);
    onDone?.({ total: alvos.length, ...cont });
  }

  return (
    <Button variant="outline" size="sm" onClick={corrigir} disabled={rodando} className="gap-2 flex-1 md:flex-none" title="Corrigir recebimentos, aplicações e resgates pela descrição">
      <Wand2 className="w-4 h-4" /> {rodando ? 'Corrigindo...' : 'Corrigir receitas/aplicações'}
    </Button>
  );
}