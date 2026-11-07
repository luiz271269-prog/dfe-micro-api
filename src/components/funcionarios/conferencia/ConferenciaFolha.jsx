import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { conferirFolhaCompetencia } from '@/functions/conferirFolhaCompetencia';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import NavegacaoTemporalFolha from '@/components/funcionarios/folha/NavegacaoTemporalFolha';
import ResumoConferencia from './ResumoConferencia';
import FolhaConferenciaLinha from './FolhaConferenciaLinha';
import OrfaosConferencia from './OrfaosConferencia';

export default function ConferenciaFolha({ resumos, competencia, onChangeCompetencia }) {
  const [empresa, setEmpresa] = useState('todos');
  const [soDivergentes, setSoDivergentes] = useState(false);
  const q = useQuery({
    queryKey: ['conferencia-folha', competencia, empresa],
    queryFn: async () => { const r = await conferirFolhaCompetencia({ competencia, empresa }); if (r.data?.error) throw new Error(r.data.error); return r.data; },
  });
  const folhas = (q.data?.folhas || []).filter(f => !soDivergentes || f.anomalias > 0);
  return <div className="space-y-4">
    <NavegacaoTemporalFolha resumos={resumos} competencia={competencia} onChange={onChangeCompetencia} />
    <div className="flex flex-wrap items-center gap-2">
      <Select value={empresa} onValueChange={setEmpresa}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="todos">Todas as empresas</SelectItem><SelectItem value="NeuralTec">NeuralTec</SelectItem><SelectItem value="Liesch">Liesch</SelectItem></SelectContent>
      </Select>
      <Button variant={soDivergentes ? 'default' : 'outline'} size="sm" onClick={() => setSoDivergentes(!soDivergentes)}>Somente com divergência</Button>
      {q.data && <span className="text-xs text-muted-foreground">{q.data.total_anomalias} divergência(s) · somente leitura, nenhum vínculo ou pagamento é alterado.</span>}
    </div>
    {q.isPending && <p role="status" className="py-6 text-sm text-muted-foreground">Conferindo composição e vínculos da competência...</p>}
    {q.isError && <div role="alert" className="text-sm text-destructive">Não foi possível conferir: {q.error.message} <Button variant="outline" size="sm" onClick={() => q.refetch()}>Tentar novamente</Button></div>}
    {q.data && <>
      <ResumoConferencia data={q.data} />
      <OrfaosConferencia orfaos={q.data.orfaos} />
      {folhas.length ? folhas.map(f => <FolhaConferenciaLinha key={f.id} f={f} competencia={competencia} onSaved={() => q.refetch()} />)
        : <p className="py-6 text-center text-sm text-muted-foreground">{soDivergentes ? 'Nenhuma folha com divergência nesta competência.' : 'Nenhuma folha nesta competência.'}</p>}
    </>}
  </div>;
}