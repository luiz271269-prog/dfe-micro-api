import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, FileText, Link2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { acharContaPagarPorLancamento } from '../../lib/contasPagarEngine';

export default function PainelDDA({ lancamentos, contasPagar, mesReferencia }) {
  const [searchDDA, setSearchDDA] = useState('');
  const hoje = new Date().toISOString().slice(0, 10);

  const ddaItems = useMemo(() => {
    return lancamentos.filter(l => {
      const mes = l.mes_referencia || (l.data || '').slice(0, 7);
      const isFuturo = l.data >= hoje;
      if (!isFuturo) return false;
      if (mes !== mesReferencia) return false;
      if (l.categoria === 'transferencia' || l.categoria === 'interno') return false;
      if (searchDDA && !l.descricao?.toLowerCase().includes(searchDDA.toLowerCase())) return false;
      return true;
    }).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }, [lancamentos, mesReferencia, searchDDA, hoje]);

  const matchMap = useMemo(() => {
    const m = new Map();
    ddaItems.forEach(dda => {
      const match = acharContaPagarPorLancamento(dda, contasPagar);
      if (match) m.set(dda.id, match);
    });
    return m;
  }, [ddaItems, contasPagar]);

  const totalDDA = ddaItems.reduce((s, l) => s + Math.abs(l.valor || 0), 0);

  return (
    <div className="bg-card rounded-xl border overflow-hidden flex flex-col">
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-sm flex items-center gap-2 text-orange-800">
            <FileText className="w-4 h-4" /> DDA — Boletos a Vencer (Banco)
          </h3>
          <span className="text-xs font-bold text-orange-700">{formatCurrency(totalDDA)}</span>
        </div>
        <p className="text-[11px] text-orange-700/80">
          {ddaItems.length} item(ns) · {matchMap.size} conciliados com sistema
        </p>
      </div>
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar no DDA..." value={searchDDA} onChange={e => setSearchDDA(e.target.value)} className="pl-9 h-8 text-xs" />
        </div>
      </div>
      <div className="overflow-y-auto max-h-[600px]">
        {ddaItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum boleto a vencer no mês</div>
        ) : ddaItems.map(dda => {
          const match = matchMap.get(dda.id);
          return (
            <div key={dda.id}
              className={`px-3 py-2 border-b ${match ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-amber-300'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{dda.descricao}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    <span>{formatDate(dda.data)}</span>
                    {dda.detalhe && <span className="truncate">· {dda.detalhe}</span>}
                  </div>
                  {match && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-700">
                      <Link2 className="w-3 h-3" />
                      <span className="font-semibold">Casa com:</span>
                      <span className="truncate">{match.descricao}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs font-bold text-rose-600 tabular-nums whitespace-nowrap">{formatCurrency(Math.abs(dda.valor))}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}