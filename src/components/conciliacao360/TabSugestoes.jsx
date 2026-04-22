import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Zap, AlertTriangle, HelpCircle, Sparkles } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { gerarSugestoesMes, SCORE_MINIMO } from '../../lib/matchingEngine';

const CONF_CONFIG = {
  alta:      { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Alta' },
  media:     { color: 'bg-blue-100 text-blue-700 border-blue-200',          icon: Zap,          label: 'Média' },
  baixa:     { color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: AlertTriangle,label: 'Baixa' },
  sem_match: { color: 'bg-slate-100 text-slate-700 border-slate-200',       icon: HelpCircle,   label: 'Sem match' },
};

export default function TabSugestoes({ loading, dados, onRefresh }) {
  const [aplicando, setAplicando] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  const sugestoes = useMemo(() => gerarSugestoesMes(dados), [dados]);

  const stats = useMemo(() => {
    const byConf = { alta: 0, media: 0, baixa: 0, sem_match: 0 };
    sugestoes.forEach(s => { byConf[s.confianca]++; });
    const ambiguos = sugestoes.filter(s => s.ambiguo).length;
    return { total: sugestoes.length, byConf, ambiguos };
  }, [sugestoes]);

  const filtradas = useMemo(() => {
    if (filtro === 'todos') return sugestoes;
    if (filtro === 'ambiguo') return sugestoes.filter(s => s.ambiguo);
    return sugestoes.filter(s => s.confianca === filtro);
  }, [sugestoes, filtro]);

  async function aplicarSugestao(item, sug) {
    setAplicando(item.lancamento.id);
    if (sug.tipo === 'TituloCobranca') {
      await base44.entities.TituloCobranca.update(sug.objeto.id, {
        status: 'pago',
        data_pagamento: item.lancamento.data,
        valor_pago: item.lancamento.valor,
      });
    } else if (sug.tipo === 'NotaFiscal') {
      const novoRecebido = (sug.objeto.valor_recebido || 0) + item.lancamento.valor;
      const aberto = Math.max(0, sug.objeto.valor_total - novoRecebido);
      await base44.entities.NotaFiscal.update(sug.objeto.id, {
        valor_recebido: novoRecebido,
        valor_aberto: aberto,
        status: aberto < 0.02 ? 'pago' : 'parcial',
      });
    }
    setAplicando(null);
    onRefresh();
  }

  async function aplicarLote() {
    const altas = sugestoes.filter(s => s.confianca === 'alta' && !s.ambiguo);
    if (altas.length === 0) return;
    if (!confirm(`Aplicar ${altas.length} sugestões de alta confiança? Você pode reverter caso a caso depois.`)) return;
    setAplicando('lote');
    for (const item of altas) {
      await aplicarSugestao(item, item.melhor);
    }
    setAplicando(null);
  }

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <p className="text-sm text-blue-900 font-semibold mb-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Motor de conciliação automática
        </p>
        <p className="text-xs text-blue-800">
          Analisa todos os créditos bancários do mês e sugere vínculos com Títulos em aberto ou NFs não pagas.
          Regras: <strong>valor exato (±R$ 0,02)</strong>, <strong>data ±3 dias</strong>, score composto por valor (60) + data (30) + texto (10).
          Sugestões com score ≥ {SCORE_MINIMO} aparecem como confiáveis. Revise e aplique individualmente ou em lote.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { k: 'todos', label: `Todos (${stats.total})`, color: 'bg-slate-100 text-slate-700' },
          { k: 'alta', label: `Alta confiança (${stats.byConf.alta})`, color: 'bg-emerald-100 text-emerald-700' },
          { k: 'media', label: `Média (${stats.byConf.media})`, color: 'bg-blue-100 text-blue-700' },
          { k: 'baixa', label: `Baixa (${stats.byConf.baixa})`, color: 'bg-amber-100 text-amber-700' },
          { k: 'sem_match', label: `Sem match (${stats.byConf.sem_match})`, color: 'bg-slate-100 text-slate-700' },
          { k: 'ambiguo', label: `Ambíguos (${stats.ambiguos})`, color: 'bg-rose-100 text-rose-700' },
        ].map(f => (
          <button
            key={f.k}
            onClick={() => setFiltro(f.k)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${filtro === f.k ? `${f.color} ring-2 ring-offset-1 ring-primary` : `${f.color} opacity-60 hover:opacity-100`}`}
          >{f.label}</button>
        ))}
        <div className="ml-auto">
          <Button size="sm" onClick={aplicarLote} disabled={aplicando !== null || stats.byConf.alta === 0} className="gap-2">
            <Zap className="w-3.5 h-3.5" />
            {aplicando === 'lote' ? 'Aplicando...' : `Aplicar ${stats.byConf.alta} de alta confiança`}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Confiança</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data / Crédito bancário</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Melhor sugestão</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Score</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Outros candidatos</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Aplicar</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(item => {
                const cfg = CONF_CONFIG[item.confianca];
                const Icon = cfg.icon;
                return (
                  <tr key={item.lancamento.id} className={`border-b hover:bg-muted/20 ${item.ambiguo ? 'bg-rose-50/50' : ''}`}>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                      {item.ambiguo && <p className="text-[9px] text-rose-600 font-bold mt-0.5">AMBÍGUO</p>}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium truncate max-w-[220px]">{item.lancamento.descricao}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(item.lancamento.data)}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-600 tabular-nums">{formatCurrency(item.lancamento.valor)}</td>
                    <td className="px-3 py-2">
                      {item.melhor ? (
                        <>
                          <p className="font-medium truncate max-w-[240px]">{item.melhor.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.melhor.tipo} · Δ {item.melhor.dias}d
                          </p>
                        </>
                      ) : <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.melhor ? <span className="font-bold tabular-nums">{item.melhor.score}</span> : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-[10px]">
                      {item.sugestoes.length > 1 ? `+${item.sugestoes.length - 1} outros` : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.melhor && (
                        <Button
                          variant={item.confianca === 'alta' && !item.ambiguo ? 'default' : 'outline'}
                          size="sm"
                          className="h-6 text-[10px]"
                          disabled={aplicando !== null}
                          onClick={() => aplicarSugestao(item, item.melhor)}
                        >
                          {aplicando === item.lancamento.id ? '...' : 'Aplicar'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtradas.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum item neste filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}