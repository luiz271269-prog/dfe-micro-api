import { useState, useMemo } from 'react';
import { Search, Package } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

export default function SeletorSKU({ skus, selecionado, onSelect }) {
  const [q, setQ] = useState('');

  const filtrados = useMemo(() => {
    const termo = q.toLowerCase().trim();
    if (!termo) return skus.slice(0, 50);
    return skus.filter(s =>
      (s.descricao || '').toLowerCase().includes(termo) ||
      (s.ncm || '').includes(termo)
    ).slice(0, 50);
  }, [q, skus]);

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-4 h-4" />
          <p className="text-xs font-bold uppercase">SKUs disponíveis ({skus.length})</p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por descrição ou NCM..."
            className="w-full pl-7 pr-2 py-1.5 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        {filtrados.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">Nenhum SKU encontrado</p>
        ) : filtrados.map(s => (
          <button
            key={s.sku_key}
            onClick={() => onSelect(s)}
            className={`w-full text-left p-2.5 border-b hover:bg-muted/30 transition-colors ${selecionado?.sku_key === s.sku_key ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''}`}
          >
            <p className="text-xs font-semibold truncate">{s.descricao}</p>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-muted-foreground font-mono">NCM {s.ncm || '—'}</span>
              <span className="text-[10px] text-muted-foreground">
                {s.total_ocorrencias}× · {s.fornecedores.length} forn.
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-muted-foreground">
                {formatCurrency(s.custoMin)} – {formatCurrency(s.custoMax)}
              </span>
              {s.variacaoPct > 10 && (
                <span className={`text-[10px] font-bold ${s.variacaoPct > 30 ? 'text-rose-600' : 'text-amber-600'}`}>
                  ±{s.variacaoPct.toFixed(0)}%
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}