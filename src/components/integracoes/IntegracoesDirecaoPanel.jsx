import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import RegistrosIntegradosTable from '@/components/integracoes/RegistrosIntegradosTable';
const TIPOS={entrada:['recebimento_aluguel','recebimento_servico'],saida:['despesa_condominio'],referencia:['contrato_locacao','contrato_assistencia','ordem_servico','cadastro']};
const NOMES={entrada:'Entradas · recebíveis',saida:'Saídas · obrigações',referencia:'Referências · contratos e ordens'};
export default function IntegracoesDirecaoPanel({onChange}) {
  const [direcao,setDirecao]=useState('entrada');
  const lista=useInfiniteQuery({queryKey:['integracoes-direcao',direcao],initialPageParam:undefined,queryFn:({pageParam})=>base44.entities.IntegracaoFinanceira.filter({tipo_registro:{$in:TIPOS[direcao]}},{sort:'-ultima_sincronizacao',limit:50,...(pageParam?{cursor:pageParam}:{})}),getNextPageParam:p=>p.has_more?p.next_cursor:undefined});
  const alterar=async(item,mudanca)=>{await onChange(item,mudanca);await lista.refetch();};
  return <section className="mt-4"><div className="mb-3 flex flex-wrap gap-2">{Object.entries(NOMES).map(([k,v])=><Button key={k} variant={direcao===k?'default':'outline'} onClick={()=>setDirecao(k)}>{v}</Button>)}</div>
    {direcao==='referencia'&&<p className="mb-3 text-sm text-muted-foreground">Contrato ou ordem de serviço não é automaticamente um recebível. A parcela ou fatura precisa ser identificada na fonte oficial.</p>}
    {lista.isLoading?<p>Carregando fontes…</p>:lista.isError?<p className="text-destructive">{lista.error.message}</p>:<RegistrosIntegradosTable registros={lista.data?.pages.flatMap(p=>p.items)||[]} onChange={alterar} />}
    {lista.hasNextPage&&<Button className="mt-3" variant="outline" onClick={()=>lista.fetchNextPage()} disabled={lista.isFetchingNextPage}>Carregar mais</Button>}
  </section>;
}