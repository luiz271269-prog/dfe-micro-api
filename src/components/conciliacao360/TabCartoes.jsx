import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CreditCard, User, Briefcase, RotateCcw } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

const NATUREZA_CONFIG = {
  empresarial: { icon: Briefcase, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Empresarial' },
  pessoal:     { icon: User, color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Pessoal' },
  reembolso:   { icon: RotateCcw, color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Reembolso' },
};

export default function TabCartoes({ loading, dados, onRefresh }) {
  const [atualizando, setAtualizando] = useState(null);

  // Lançamentos de cartão agrupados por fatura do mês
  const faturasDoMes = useMemo(() => {
    return dados.faturas.filter(f => {
      const lancs = dados.lancCartao.filter(l => l.fatura_id === f.id);
      return lancs.length > 0;
    }).map(f => {
      const lancs = dados.lancCartao.filter(l => l.fatura_id === f.id);
      const cartao = dados.cartoes.find(c => c.id === f.conta_cartao_id);
      const totalEmpresarial = lancs.filter(l => l.natureza === 'empresarial').reduce((a, l) => a + l.valor, 0);
      const totalPessoal = lancs.filter(l => l.natureza === 'pessoal').reduce((a, l) => a + l.valor, 0);
      const totalReembolso = lancs.filter(l => l.natureza === 'reembolso').reduce((a, l) => a + l.valor, 0);
      const semClassificacao = lancs.filter(l => !l.natureza).length;
      return { ...f, cartao, lancs, totalEmpresarial, totalPessoal, totalReembolso, semClassificacao };
    });
  }, [dados]);

  async function mudarNatureza(lanc, novaNatureza) {
    setAtualizando(lanc.id);
    await base44.entities.LancamentoCartao.update(lanc.id, { natureza: novaNatureza });
    setAtualizando(null);
    onRefresh();
  }

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;

  const stats = {
    totalEmpresarial: faturasDoMes.reduce((a, f) => a + f.totalEmpresarial, 0),
    totalPessoal: faturasDoMes.reduce((a, f) => a + f.totalPessoal, 0),
    totalReembolso: faturasDoMes.reduce((a, f) => a + f.totalReembolso, 0),
    semClassificacao: faturasDoMes.reduce((a, f) => a + f.semClassificacao, 0),
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3">
          <p className="text-[10px] font-bold uppercase text-blue-700">Empresarial (custo empresa)</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(stats.totalEmpresarial)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-bold uppercase text-slate-700">Pessoal (não é despesa)</p>
          <p className="text-xl font-bold text-slate-700">{formatCurrency(stats.totalPessoal)}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
          <p className="text-[10px] font-bold uppercase text-amber-700">Reembolso (a receber)</p>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(stats.totalReembolso)}</p>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-3">
          <p className="text-[10px] font-bold uppercase text-rose-700">Sem classificação</p>
          <p className="text-xl font-bold text-rose-700">{stats.semClassificacao}</p>
        </div>
      </div>

      {faturasDoMes.length === 0 && (
        <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground text-sm">
          Nenhuma fatura com lançamentos encontrada.
        </div>
      )}

      {faturasDoMes.map(f => (
        <div key={f.id} className="bg-card rounded-xl border overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-purple-600 to-violet-700 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <div>
                <p className="font-bold text-sm">{f.cartao?.nome || 'Cartão'}</p>
                <p className="text-[11px] opacity-80">Fatura {f.mes_referencia} · venc. {formatDate(f.data_vencimento)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-80">Total fatura</p>
              <p className="font-bold">{formatCurrency(f.valor_total)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Estabelecimento</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Natureza atual</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Reclassificar</th>
                </tr>
              </thead>
              <tbody>
                {f.lancs.map(l => {
                  const cfg = NATUREZA_CONFIG[l.natureza] || { icon: CreditCard, color: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Sem classif.' };
                  const Icon = cfg.icon;
                  return (
                    <tr key={l.id} className="border-b hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(l.data_lancamento)}</td>
                      <td className="px-3 py-2 font-medium">
                        <p className="truncate max-w-[240px]">{l.estabelecimento}</p>
                        {l.observacao && <p className="text-[10px] text-muted-foreground truncate max-w-[240px]">{l.observacao}</p>}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{formatCurrency(l.valor)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cfg.color}`}>
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex gap-1">
                          {['empresarial', 'pessoal', 'reembolso'].filter(n => n !== l.natureza).map(n => {
                            const c = NATUREZA_CONFIG[n];
                            const I = c.icon;
                            return (
                              <Button key={n} variant="outline" size="sm" className="h-6 w-6 p-0" title={c.label}
                                disabled={atualizando === l.id}
                                onClick={() => mudarNatureza(l, n)}>
                                <I className="w-3 h-3" />
                              </Button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}