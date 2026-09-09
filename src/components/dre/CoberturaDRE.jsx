import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function CoberturaDRE({ cobertura, cmvProvisorio }) {
  if (!cobertura) return null;
  const itens = [
    ['Com vínculo bancário', cobertura.vinculados],
    ['Fallback com data de pagamento', cobertura.fallbacks],
    ['Sem comprovação de caixa', cobertura.sem_comprovacao],
    ['Cartões sem classificação', cobertura.cartoes_sem_classificacao],
    ['Registros sem empresa', cobertura.sem_empresa],
  ];
  const temPendencia = cmvProvisorio || cobertura.sem_comprovacao > 0 || cobertura.cartoes_sem_classificacao > 0;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold">
        {temPendencia ? <AlertTriangle className="text-warning" /> : <CheckCircle2 className="text-success" />}
        Integridade do período
      </div>
      {cmvProvisorio && (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">
          CMV provisório: representa compras e entradas de estoque do período, não o custo das mercadorias efetivamente vendidas.
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-lg bg-muted p-2">
            <p className="text-lg font-bold tabular-nums">{valor || 0}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{rotulo}</p>
          </div>
        ))}
      </div>
    </div>
  );
}