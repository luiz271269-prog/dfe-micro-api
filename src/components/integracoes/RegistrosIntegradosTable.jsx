import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const moeda = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RegistrosIntegradosTable({ registros, onChange }) {
  if (!registros.length) return <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Nenhum registro disponível nas entidades expostas pelos aplicativos.</div>;
  return <div className="rounded-lg border bg-card overflow-x-auto"><table className="w-full text-sm">
    <thead className="bg-muted/60"><tr><th className="p-3 text-left">Origem</th><th className="p-3 text-left">Tipo</th><th className="p-3 text-left">Descrição</th><th className="p-3 text-left">Contraparte</th><th className="p-3 text-left">Vencimento</th><th className="p-3 text-right">Valor</th><th className="p-3 text-left">Status</th></tr></thead>
    <tbody>{registros.map(item => <tr key={item.id} className="border-t">
      <td className="p-3"><Badge variant="outline">{item.app_origem === 'locacoes' ? 'Locações' : 'Assistência'}</Badge></td>
      <td className="p-3 text-muted-foreground">{item.tipo_registro.replaceAll('_', ' ')}</td>
      <td className="p-3 font-medium">{item.descricao || '—'}{item.pendente_envio && <span className="block text-xs text-warning">envio pendente</span>}</td>
      <td className="p-3">{item.contraparte || '—'}</td><td className="p-3">{item.data_vencimento || '—'}</td>
      <td className="p-3 text-right"><Input className="w-28 ml-auto text-right" type="number" defaultValue={item.valor || 0} onBlur={e => Number(e.target.value) !== Number(item.valor || 0) && onChange(item, { valor: Number(e.target.value) })} aria-label={`Valor atual ${moeda(item.valor)}`} /></td>
      <td className="p-3"><Input className="min-w-28" defaultValue={item.status || ''} onBlur={e => e.target.value !== (item.status || '') && onChange(item, { status: e.target.value })} /></td>
    </tr>)}</tbody>
  </table></div>;
}