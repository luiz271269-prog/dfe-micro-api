import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import BaixaAcaoRegistro from '@/components/baixas/BaixaAcaoRegistro';
import AlertaChips from './AlertaChips';
import VinculoConferenciaLinha from './VinculoConferenciaLinha';
import { reais, TIPOS } from './rotulosConferencia';

export default function FolhaConferenciaLinha({ f, competencia, onSaved }) {
  const [aberto, setAberto] = useState(f.anomalias > 0);
  const c = f.composicao, e = f.evidencias;
  return <div className="rounded-xl border bg-card">
    <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-left">
      {aberto ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      <span className="min-w-[180px] font-semibold">{f.funcionario_nome}<span className="ml-2 text-xs font-normal text-muted-foreground">{TIPOS[f.tipo]} · {f.empresa || '—'} · {f.status}</span></span>
      <span className="text-xs">Proventos <b className="tabular-nums">{reais(c.proventos)}</b></span>
      <span className="text-xs">Descontos <b className="tabular-nums">{reais(c.descontos)}</b></span>
      <span className="text-xs">Líquido <b className="tabular-nums">{reais(c.armazenado)}</b>{c.diferenca !== 0 && <span className="text-destructive"> (calc. {reais(c.calculado)})</span>}</span>
      <span className="text-xs">Banco <b className="tabular-nums">{reais(e.pagamento_banco)}</b></span>
      <span className="text-xs">Saldo pelo banco <b className="tabular-nums">{reais(f.saldo_por_banco)}</b></span>
      {f.anomalias > 0 && <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">{f.anomalias} divergência(s)</span>}
    </button>
    {aberto && <div className="border-t px-4 py-3 space-y-3">
      <AlertaChips alertas={f.alertas} />
      <p className="text-xs text-muted-foreground">Evidências mostradas separadamente, sem somar: banco {reais(e.pagamento_banco)} · adiantamentos vinculados {reais(e.por_categoria.adiantamento)} · pago informado no cadastro {reais(e.informado)} · baixas manuais {reais(e.manuais)}.</p>
      {f.vinculos.length ? <div className="overflow-x-auto"><table className="w-full">
        <thead><tr className="text-[11px] text-muted-foreground"><th className="px-3 py-1 text-left">Data banco</th><th className="px-3 py-1 text-left">Extrato</th><th className="px-3 py-1 text-left">Tipo</th><th className="px-3 py-1 text-right">Alocado</th><th className="px-3 py-1 text-right">Débito</th><th className="px-3 py-1 text-left">Conferência</th></tr></thead>
        <tbody>{f.vinculos.map(v => <VinculoConferenciaLinha key={v.id} v={v} />)}</tbody>
      </table></div> : <p className="text-xs text-muted-foreground">Nenhum vínculo bancário. Isso não comprova falta de pagamento.</p>}
      <div className="flex justify-end">
        <BaixaAcaoRegistro entidade="FolhaPagamento" registroId={f.id} descricao={`${f.funcionario_nome} · ${competencia}`} onSaved={onSaved} abaInicial="dados">Revisar vínculos desta folha</BaixaAcaoRegistro>
      </div>
    </div>}
  </div>;
}