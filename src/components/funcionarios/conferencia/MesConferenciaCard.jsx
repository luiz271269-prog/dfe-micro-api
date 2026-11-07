import { SITUACOES, MESES_CURTOS, reais } from './rotulosConferencia';

export default function MesConferenciaCard({ m, ativo, onClick }) {
  const s = SITUACOES[m.situacao];
  const n = m.fora_janela_natureza;
  return <button type="button" onClick={onClick}
    className={`text-left rounded-xl border p-3 transition-all hover:shadow-sm hover:-translate-y-0.5 ${ativo ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'bg-card'} ${m.situacao === 'sem_folha' ? 'opacity-60' : ''}`}>
    <div className="flex items-baseline justify-between">
      <span className="text-sm font-semibold">{MESES_CURTOS[Number(m.competencia.slice(5)) - 1]}</span>
      <span className={`text-[11px] font-medium ${s.cls}`}>{s.label}</span>
    </div>
    {m.situacao !== 'sem_folha' && <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
      <p>{m.folhas} folha(s) · {m.vinculos} vínculo(s)</p>
      <p>Líquido <span className="tabular-nums text-foreground">{reais(m.liquido)}</span></p>
      <p>Banco <span className="tabular-nums text-foreground">{reais(m.pagamento_banco)}</span></p>
      {m.divergencias > 0 && <p className="text-destructive">{m.divergencias} divergência(s)</p>}
      {m.fora_janela > 0 && <p className="text-amber-700">{m.fora_janela} fora da janela{n.possivel_comissao ? ` · ${n.possivel_comissao} poss. comissão` : ''}</p>}
    </div>}
  </button>;
}