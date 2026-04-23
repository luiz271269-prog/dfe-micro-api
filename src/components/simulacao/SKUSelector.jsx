import { useState, useMemo } from 'react';
import { Search, Package, Repeat } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '../../lib/formatters';

export default function SKUSelector({ skus, selecionado, onSelect }) {
  const [filtro, setFiltro] = useState('');
  const [apenasRecorrentes, setApenasRecorrentes] = useState(true);

  const filtrados = useMemo(() => {
    const f = filtro.toLowerCase().trim();
    return skus
      .filter(s => !apenasRecorrentes || s.recorrente)
      .filter(s => !f || s.descricao_canonica?.toLowerCase().includes(f) || (s.ncm_principal || '').includes(f))
      .slice(0, 100);
  }, [skus, filtro, apenasRecorrentes]);

  return (
    <div className="bg-card border rounded-xl overflow-hidden flex flex-col max-h-[540px]">
      <div className="p-3 border-b bg-muted/30 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou NCM..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={apenasRecorrentes}
            onChange={e => setApenasRecorrentes(e.target.checked)}
            className="rounded"
          />
          <Repeat className="w-3.5 h-3.5" />
          Apenas SKUs recorrentes (≥2 ocorrências)
        </label>
        <p className="text-[10px] text-muted-foreground">{filtrados.length} produtos</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtrados.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">Nenhum produto encontrado.</div>
        )}
        {filtrados.map(sku => {
          const ativo = selecionado?.sku_key === sku.sku_key;
          return (
            <button
              key={sku.sku_key}
              onClick={() => onSelect(sku)}
              className={`w-full text-left px-3 py-2 border-b transition-colors ${ativo ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-muted/30'}`}
            >
              <div className="flex items-start gap-2">
                <Package className={`w-4 h-4 mt-0.5 shrink-0 ${ativo ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold truncate ${ativo ? 'text-indigo-900' : ''}`}>{sku.descricao_canonica}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                    {sku.ncm_principal && <span className="font-mono">NCM {sku.ncm_principal}</span>}
                    <span>{sku.qtd_ocorrencias}× compras</span>
                    <span>{sku.qtd_fornecedores} fornec.</span>
                    <span className="font-semibold text-foreground">{formatCurrency(sku.valor_total)}</span>
                    {sku.variacao_pct > 10 && (
                      <span className={sku.variacao_pct > 20 ? 'text-rose-600 font-bold' : 'text-amber-600 font-bold'}>
                        ±{sku.variacao_pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}