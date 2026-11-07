import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { conferirFolhaCompetencia } from '@/functions/conferirFolhaCompetencia';
import { Button } from '@/components/ui/button';
import MesConferenciaCard from './MesConferenciaCard';
import NaturezaChip from './NaturezaChip';
import { reais } from './rotulosConferencia';

export default function ResumoAnualConferencia({ ano, onAno, empresa, competencia, onCompetencia }) {
  const q = useQuery({
    queryKey: ['conferencia-folha-ano', ano, empresa],
    queryFn: async () => { const r = await conferirFolhaCompetencia({ modo: 'ano', ano: String(ano), empresa }); if (r.data?.error) throw new Error(r.data.error); return r.data; },
  });
  const t = q.data?.totais;
  return <section className="space-y-3 rounded-2xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onAno(ano - 1)} aria-label="Ano anterior"><ChevronLeft /></Button>
        <h3 className="text-base font-semibold tabular-nums">Conferência {ano}</h3>
        <Button variant="ghost" size="icon" onClick={() => onAno(ano + 1)} aria-label="Próximo ano"><ChevronRight /></Button>
      </div>
      {t && <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{t.folhas} folhas · {t.vinculos} vínculos</span>
        <span>Líquido <b className="text-foreground tabular-nums">{reais(t.liquido)}</b></span>
        <span>Banco <b className="text-foreground tabular-nums">{reais(t.pagamento_banco)}</b></span>
        <span>Adiantamentos <b className="text-foreground tabular-nums">{reais(t.adiantamento)}</b></span>
        <span className="text-destructive">{t.divergencias} divergência(s)</span>
      </div>}
    </div>
    {q.isPending && <p role="status" className="py-4 text-sm text-muted-foreground">Montando resumo do ano...</p>}
    {q.isError && <div role="alert" className="text-sm text-destructive">Falha ao consultar o ano: {q.error.message} <Button variant="outline" size="sm" onClick={() => q.refetch()}>Tentar novamente</Button></div>}
    {q.data && <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {q.data.meses.map(m => <MesConferenciaCard key={m.competencia} m={m} ativo={m.competencia === competencia} onClick={() => onCompetencia(m.competencia)} />)}
      </div>
      {t.fora_janela > 0 && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{t.fora_janela} PIX fora da janela no ano:</span>
        {Object.entries(t.fora_janela_natureza).filter(([, c]) => c).map(([k, c]) => <NaturezaChip key={k} natureza={k}>· {c}</NaturezaChip>)}
      </div>}
    </>}
  </section>;
}