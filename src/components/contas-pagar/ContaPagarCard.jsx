import { Link2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { mapearTipoEntidade } from '@/lib/contasPagarEngine';
import SeletorClassificacao from '@/components/shared/SeletorClassificacao';

const LINKS = { despesa: '/despesas', tributo: '/tributos', folha: '/funcionarios', fatura: '/cartoes', compra: '/compras', obra: '/obras', pro_labore: '/prolabore' };

export default function ContaPagarCard({ item, conciliado, modo }) {
  const entityName = mapearTipoEntidade(item.origem_tipo);
  return <div className="rounded-lg border bg-card p-3 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="truncate text-xs font-semibold">{item.descricao}</p><p className="truncate text-[10px] text-muted-foreground">{item.fornecedor || '—'}</p></div>
      <p className="whitespace-nowrap text-xs font-bold tabular-nums text-destructive">{formatCurrency(item.valor)}</p>
    </div>
    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
      <span>{item.data_vencimento ? formatDate(item.data_vencimento) : 'Sem data'}</span>
      {conciliado ? <span className="inline-flex items-center gap-1 font-semibold text-success"><Link2 className="h-3 w-3" />{modo === 'pagos' ? 'Conciliado' : 'OK'}</span> : <span className="inline-flex items-center gap-1 font-semibold text-warning"><AlertTriangle className="h-3 w-3" />Pendente</span>}
    </div>
    {entityName && !item.is_planejado && <div className="mt-2 flex flex-wrap gap-1"><SeletorClassificacao eixo="origem" entityName={entityName} record={{ id: item.origem_id, origem_compra: item.origem_compra }} field="origem_compra" /><SeletorClassificacao eixo="tipo" entityName={entityName} record={{ id: item.origem_id, tipo_compra: item.tipo_compra }} field="tipo_compra" /></div>}
    <Link to={LINKS[item.origem_tipo] || '/contas-a-pagar'} className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary">Ver origem <ArrowRight className="h-3 w-3" /></Link>
  </div>;
}