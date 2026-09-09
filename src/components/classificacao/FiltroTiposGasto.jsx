import { TIPOS_COMPRA, tipoGastoValido } from '@/lib/classificacaoUnificada';
import { formatCurrency } from '@/lib/formatters';

export default function FiltroTiposGasto({ itens, value, onChange }) {
  const chave = i => i.origem_tipo === 'fatura' ? 'fatura' : tipoGastoValido(i.tipo_compra) ? i.tipo_compra : 'pendente';
  const totais = itens.reduce((a, i) => { const k = chave(i); a[k] = (a[k] || 0) + (i.valor || 0); return a; }, {});
  const opcoes = { todos: 'Todos os gastos', ...TIPOS_COMPRA, pendente: 'Pendente de classificação' };
  return <div className="space-y-2 mb-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {Object.entries(opcoes).map(([key, label]) => <button key={key} type="button" onClick={() => onChange(key)} aria-pressed={value === key} className={`rounded-lg border px-3 py-2 text-left ${value === key ? 'ring-2 ring-primary bg-primary/5' : 'bg-card hover:bg-muted/30'}`}>
        <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
        <p className="text-sm font-bold tabular-nums">{formatCurrency(key === 'todos' ? itens.reduce((s, i) => s + (i.valor || 0), 0) : totais[key] || 0)}</p>
      </button>)}
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <button type="button" onClick={() => onChange('fatura')} aria-pressed={value === 'fatura'} className={`rounded-lg border px-3 py-2 ${value === 'fatura' ? 'ring-2 ring-primary bg-primary/5' : 'bg-card'}`}>Faturas de cartão · {formatCurrency(totais.fatura || 0)}</button>
      <span>Cartão é forma de pagamento: faturas incluídas no total, separadas dos tipos dos gastos diretos; classifique cada lançamento no cartão.</span>
    </div>
  </div>;
}