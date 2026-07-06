import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { conciliarCartoesDespesas } from '@/functions/conciliarCartoesDespesas';
import { conciliarCobrancasBanco } from '@/functions/conciliarCobrancasBanco';
import { conciliarFaturamentoFluxoCaixa } from '@/functions/conciliarFaturamentoFluxoCaixa';
import { conciliarObrasCartoes } from '@/functions/conciliarObrasCartoes';
import { conciliarContasAPagarExtrato } from '@/functions/conciliarContasAPagarExtrato';
import { conciliarFolhaExtrato } from '@/functions/conciliarFolhaExtrato';
import { CreditCard, Wallet, FileText, Hammer, Users, Banknote, Loader2, CheckCircle2 } from 'lucide-react';

const CONCILIACOES = [
  { key: 'contas_apagar', label: 'Despesas ↔ Banco', desc: 'Despesas, tributos e faturas vs extrato', icon: Wallet, fn: conciliarContasAPagarExtrato },
  { key: 'folha', label: 'Folha ↔ Banco', desc: 'Pagamentos de folha vs PIX no extrato', icon: Users, fn: conciliarFolhaExtrato },
  { key: 'cobrancas', label: 'Cobranças ↔ Banco', desc: 'Títulos Sicredi vs recebimentos', icon: Banknote, fn: conciliarCobrancasBanco },
  { key: 'cartoes_despesas', label: 'Cartões ↔ Despesas', desc: 'Transações de cartão vs despesas', icon: CreditCard, fn: conciliarCartoesDespesas },
  { key: 'obras_cartoes', label: 'Obras ↔ Cartões', desc: 'Pagamentos de obra vs cartão', icon: Hammer, fn: conciliarObrasCartoes },
  { key: 'faturamento_fluxo', label: 'Faturamento ↔ Fluxo Caixa', desc: 'Previsão de recebimento vs realizado', icon: FileText, fn: conciliarFaturamentoFluxoCaixa },
];

export default function PainelConciliacoes({ onConciliado }) {
  const [resultados, setResultados] = useState({});
  const [rodando, setRodando] = useState(null);

  async function rodar(item) {
    setRodando(item.key);
    try {
      const res = await item.fn({});
      setResultados(prev => ({ ...prev, [item.key]: res?.data || { error: 'sem resposta' } }));
      if (onConciliado) await onConciliado();
    } catch (e) {
      setResultados(prev => ({ ...prev, [item.key]: { error: e.message } }));
    }
    setRodando(null);
  }

  async function rodarTodas() {
    for (const item of CONCILIACOES) {
      await rodar(item);
    }
  }

  return (
    <div className="bg-card rounded-xl border p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Motor de Conciliação</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Rode as conciliações para aumentar a cobertura</p>
        </div>
        <Button size="sm" variant="outline" onClick={rodarTodas} disabled={rodando !== null} className="gap-2">
          {rodando !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {rodando !== null ? 'Processando...' : 'Rodar todas'}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {CONCILIACOES.map(item => {
          const Icon = item.icon;
          const res = resultados[item.key];
          const isRodando = rodando === item.key;
          return (
            <div key={item.key} className="border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => rodar(item)} disabled={rodando !== null} className="gap-2 h-7 text-xs">
                {isRodando && <Loader2 className="w-3 h-3 animate-spin" />}
                {isRodando ? 'Rodando...' : 'Rodar'}
              </Button>
              {res && !res.error && (
                <div className="text-[10px] bg-emerald-50 rounded p-1.5 space-y-0.5">
                  {res.tributos_auto_criados > 0 && <p className="text-blue-700">📋 {res.tributos_auto_criados} tributos criados</p>}
                  {res.baixas_automaticas > 0 && <p className="text-emerald-700">✓ {res.baixas_automaticas} baixas auto</p>}
                  {res.sugestoes_criadas > 0 && <p className="text-amber-700">⚠ {res.sugestoes_criadas} sugestões</p>}
                  {res.realizados > 0 && <p className="text-emerald-700">✓ {res.realizados} realizados</p>}
                  {res.confirmados > 0 && <p className="text-blue-700">✓ {res.confirmados} confirmados</p>}
                  {res.conciliadas > 0 && <p className="text-emerald-700">✓ {res.conciliadas} conciliadas</p>}
                  {res.baixas_automaticas === 0 && res.sugestoes_criadas === 0 && res.realizados === 0 && res.conciliadas === 0 && res.tributos_auto_criados === 0 && (
                    <p className="text-muted-foreground">Nada a conciliar</p>
                  )}
                </div>
              )}
              {res?.error && <p className="text-[10px] text-rose-600">Erro: {res.error}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}