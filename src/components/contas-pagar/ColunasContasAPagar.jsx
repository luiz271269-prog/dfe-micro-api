import { useMemo } from 'react';
import { formatCurrency } from '@/lib/formatters';
import ContaPagarCard from './ContaPagarCard';

const COLUNAS = [
  { id: 'fixas', titulo: 'Despesas fixas', descricao: 'Recorrentes' },
  { id: 'variaveis', titulo: 'Despesas variáveis', descricao: 'Não recorrentes' },
  { id: 'compras', titulo: 'Compras', descricao: 'Estoque / revenda' },
];

function classificar(item) {
  if (item.origem_tipo === 'compra' || item.tipo_compra === 'estoque') return 'compras';
  return item.recorrente ? 'fixas' : 'variaveis';
}

export default function ColunasContasAPagar({ itens, conciliadosSet, mesReferencia, modo }) {
  const grupos = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const visiveis = itens.filter(i => !i.data_vencimento || i.data_vencimento.slice(0, 7) === mesReferencia || (modo === 'aberto' && i.data_vencimento < hoje));
    return Object.fromEntries(COLUNAS.map(c => [c.id, visiveis.filter(i => classificar(i) === c.id).sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))]));
  }, [itens, mesReferencia, modo]);

  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    {COLUNAS.map(coluna => {
      const lista = grupos[coluna.id];
      const total = lista.reduce((s, i) => s + (i.valor || 0), 0);
      return <section key={coluna.id} className="overflow-hidden rounded-xl border bg-muted/20">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3"><div><h3 className="text-sm font-bold">{coluna.titulo}</h3><p className="text-[10px] text-muted-foreground">{coluna.descricao} · {lista.length} itens</p></div><strong className="text-sm tabular-nums">{formatCurrency(total)}</strong></header>
        <div className="max-h-[600px] space-y-2 overflow-y-auto p-2">{lista.length ? lista.map(item => <ContaPagarCard key={item.id} item={item} conciliado={conciliadosSet.has(item)} modo={modo} />) : <p className="py-10 text-center text-xs text-muted-foreground">Nenhum item neste período.</p>}</div>
      </section>;
    })}
  </div>;
}