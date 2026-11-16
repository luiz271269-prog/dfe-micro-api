import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function DebitoExtratoLinha({ linha, onConferir }) {
  const { debito, conta, score, diferenca } = linha;
  return (
    <li className="grid items-center gap-3 px-4 py-3 md:grid-cols-[1fr_auto_1fr_auto]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{debito.descricao}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(debito.data)} · {debito.conta_bancaria || 'Conta não informada'} · <span className="font-semibold text-foreground tabular-nums">{formatCurrency(Math.abs(debito.valor || 0))}</span>
        </p>
      </div>
      <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
      {conta ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{conta.descricao}</p>
          <p className="text-xs text-muted-foreground">
            {conta.tipo_label} · {conta.fornecedor}{conta.data_vencimento ? ` · venc. ${formatDate(conta.data_vencimento)}` : ''} · <span className="font-semibold text-foreground tabular-nums">{formatCurrency(conta.valor)}</span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-primary">
            {score}% compatível · {diferenca < 0.5 ? 'valores batem' : `diferença de ${formatCurrency(diferenca)}`}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma conta em aberto compatível no Contas a Pagar.</p>
      )}
      <Button size="sm" variant="outline" onClick={() => onConferir(debito)}>
        {conta ? 'Conferir e conciliar' : 'Procurar conta'}
      </Button>
    </li>
  );
}