import { formatCurrency, formatDate } from '../../lib/formatters';

const CORES = {
  orange: { head: 'text-orange-600', total: 'text-orange-700' },
  blue: { head: 'text-blue-600', total: 'text-blue-700' },
  purple: { head: 'text-purple-600', total: 'text-purple-700' },
};

export default function ProLaboreListaOrigem({ titulo, icon: Icon, cor = 'blue', total, itens, emptyHint }) {
  const c = CORES[cor] || CORES.blue;
  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className={`w-4 h-4 ${c.head}`} />}
        <h3 className="text-sm font-bold">{titulo}</h3>
        <span className={`ml-auto text-sm font-bold ${c.total}`}>{formatCurrency(total)}</span>
      </div>
      {(!itens || itens.length === 0) ? (
        <p className="text-xs text-muted-foreground py-3 leading-relaxed">{emptyHint || 'Nenhum lançamento no período.'}</p>
      ) : (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {itens.map(l => (
                <tr key={l.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="py-1.5 whitespace-nowrap w-20 text-muted-foreground">{formatDate(l.data)}</td>
                  <td className="py-1.5 pr-2 break-words">
                    {l.descricao}
                    {l.conta && <span className="block text-[10px] text-muted-foreground">{l.conta}</span>}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums whitespace-nowrap">{formatCurrency(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}