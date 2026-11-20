import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AuditoriaRecebiveisGrupo from '@/components/cobrancas/AuditoriaRecebiveisGrupo';
import AuditoriaRecebiveisRegistros from '@/components/cobrancas/AuditoriaRecebiveisRegistros';

const horario = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

const GRUPOS = [
  ['total_parcelas', 'Total da nota × parcelas'],
  ['vinculo', 'Vínculo da parcela com a nota'],
  ['valor_pago', 'Valores recebidos'],
  ['status', 'Status de pagamento'],
];

export default function AuditoriaRecebiveis() {
  const verificacao = useQuery({
    queryKey: ['auditoria-recebiveis-ultima'],
    queryFn: async () => (await base44.entities.VerificacaoRecebiveis.list({ limit: 1, sort: '-concluida_em' })).items[0] || null,
  });
  const ultima = verificacao.data;
  return <section aria-labelledby="auditoria-recebiveis-titulo" className="mx-auto my-4 w-full max-w-[420px] overflow-hidden rounded-lg border bg-card text-card-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
    <header className="space-y-1 border-b p-4">
      <h2 id="auditoria-recebiveis-titulo" className="text-lg font-semibold tracking-tight">Verificação diária de recebíveis</h2>
      <p className="text-sm text-muted-foreground">Notas e parcelas · Somente leitura, sem baixas.</p>
      <p className="text-xs text-muted-foreground" role="status">{ultima ? `Última verificação: ${horario.format(new Date(ultima.concluida_em))} (Brasília) · ${ultima.notas} notas e ${ultima.parcelas} parcelas lidas.` : verificacao.isPending ? 'Consultando a última execução…' : verificacao.isError ? 'Não foi possível consultar a última execução.' : 'Aguardando a primeira verificação.'}</p>
    </header>
    <div className="divide-y">{GRUPOS.map(([tipo, nome], i) => {
      const total = ultima ? ultima.totais?.[tipo] || 0 : undefined;
      return <AuditoriaRecebiveisGrupo key={tipo} nome={nome} indice={i} total={total} indisponivel={verificacao.isError && !ultima}>
        {total ? <AuditoriaRecebiveisRegistros tipo={tipo} versao={ultima.concluida_em} /> : null}
      </AuditoriaRecebiveisGrupo>;
    })}</div>
  </section>;
}