import { Badge } from '@/components/ui/badge';
import useIntegradosModulo from '@/hooks/useIntegradosModulo';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function IntegradosModuloPanel({ modulo, titulo }) {
  const { registros, carregando } = useIntegradosModulo(modulo);
  const total = registros.reduce((soma, item) => soma + Number(item.valor || 0), 0);
  return <section className="my-4 overflow-hidden rounded-xl border bg-card">
    <header className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
      <div><h2 className="text-sm font-semibold">{titulo}</h2><p className="text-xs text-muted-foreground">Dados rastreados pela central de integrações</p></div>
      <div className="text-right"><p className="text-sm font-bold tabular-nums">{formatCurrency(total)}</p><p className="text-xs text-muted-foreground">{registros.length} registro(s)</p></div>
    </header>
    {carregando ? <p className="p-4 text-sm text-muted-foreground">Carregando integrações...</p> : registros.length === 0 ?
      <p className="p-4 text-sm text-muted-foreground">Nenhum registro disponível nas fontes conectadas.</p> :
      <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{registros.map(item =>
        <tr key={item.id} className="border-t first:border-t-0">
          <td className="px-4 py-3"><Badge variant="outline">{item.app_origem === 'locacoes' ? 'Locações' : 'Assistência'}</Badge></td>
          <td className="px-4 py-3"><p className="font-medium">{item.descricao || '—'}</p><p className="text-xs text-muted-foreground">{item.contraparte || item.tipo_registro.replaceAll('_', ' ')}</p></td>
          <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.data_vencimento || item.data_referencia)}</td>
          <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(item.valor)}</td>
          <td className="px-4 py-3 text-xs">{item.status || 'sem status'}</td>
        </tr>)}</tbody></table></div>}
  </section>;
}