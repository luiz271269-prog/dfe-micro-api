import StatusBadge from '@/components/shared/StatusBadge';
import SeletorClassificacao from '@/components/shared/SeletorClassificacao';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function TributoMobileCard({ tributo, onRefresh }) {
  const origem = tributo._lancamento || tributo;
  const entityName = tributo._lancamento ? 'LancamentoBancario' : 'Tributo';

  return (
    <article className={`rounded-xl border bg-card p-3 ${tributo.status === 'vencido' ? 'border-destructive/40' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <strong className="text-sm">{tributo.tipo}</strong>
            {tributo._lancamento && <span className="text-[10px] text-muted-foreground">Extrato</span>}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{tributo.descricao || 'Sem descrição'}</p>
        </div>
        <StatusBadge status={tributo.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <span><b>Competência</b><br />{tributo.competencia || '—'}</span>
        <span><b>Vencimento</b><br />{formatDate(tributo.data_vencimento)}</span>
        <span><b>Empresa</b><br />{tributo.empresa || '—'}</span>
        <span className="text-right"><b>Valor</b><br /><strong className="text-sm">{formatCurrency(tributo.valor_original)}</strong></span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <SeletorClassificacao eixo="origem" entityName={entityName} record={origem} field="origem_compra" onChange={onRefresh} />
        <SeletorClassificacao eixo="tipo" entityName={entityName} record={origem} field="tipo_compra" onChange={onRefresh} />
      </div>
    </article>
  );
}