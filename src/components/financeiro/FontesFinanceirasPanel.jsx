import { Link } from 'react-router-dom';
import { FONTES_FINANCEIRAS } from '@/lib/fontesFinanceiras';
export default function FontesFinanceirasPanel() {
  return <details className="rounded-xl border bg-card mb-4">
    <summary className="cursor-pointer p-3 text-sm font-semibold">Fontes oficiais e conciliações · Entradas / Saídas</summary>
    <div className="grid gap-4 p-4 pt-0 lg:grid-cols-2">{Object.entries(FONTES_FINANCEIRAS).map(([direcao, fontes]) => <section key={direcao} className="rounded-lg border p-3">
      <h3 className={direcao === 'entrada' ? 'font-semibold text-success' : 'font-semibold text-destructive'}>{direcao === 'entrada' ? 'Entradas · Contas a receber' : 'Saídas · Contas a pagar'}</h3>
      <div className="divide-y">{fontes.map(f => <div key={f.modulo} className="py-3 text-xs"><Link className="font-semibold text-primary" to={f.path}>{f.modulo}</Link><p className="mt-1">Fonte: {f.fonte}</p><p className="mt-1 text-muted-foreground">Conciliação: {f.conciliacao}</p></div>)}</div>
    </section>)}</div>
    <p className="border-t p-3 text-xs text-muted-foreground">Extrato = evidência. DDA não é pagamento. Relatório fiscal não cria outra nota. Transferências, aportes e aplicações pertencem à conferência.</p>
  </details>;
}