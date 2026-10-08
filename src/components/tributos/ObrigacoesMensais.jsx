import { useEffect, useState } from 'react';
import { revisarTributosMensais } from '@/functions/revisarTributosMensais';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/formatters';
export default function ObrigacoesMensais({ mesPagamento, empresa, revision, onCadastrar }) {
  const [competencia,setCompetencia]=useState('');
  const [dados,setDados]=useState(null);
  const [erro,setErro]=useState('');
  useEffect(()=>{const [ano,mes]=mesPagamento.split('-').map(Number);setCompetencia(new Date(Date.UTC(ano,mes-2,1)).toISOString().slice(0,7));},[mesPagamento]);
  useEffect(()=>{
    if(!competencia)return;
    let ativo=true;setDados(null);setErro('');
    revisarTributosMensais({competencia,empresa:empresa||undefined}).then(({data})=>{if(!ativo)return;if(data.error)setErro(data.error);else setDados(data);}).catch(e=>{if(ativo)setErro(e.message);});
    return()=>{ativo=false;};
  },[competencia,empresa,revision]);
  return <section className="mb-6 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Obrigações mensais · DAS, FGTS e INSS</h2><p className="text-xs text-muted-foreground">Recorrência mensal não significa valor fixo: apuração por competência, pagamento no mês seguinte.</p></div><label className="text-xs">Competência da apuração<Input type="month" value={competencia} onChange={e=>setCompetencia(e.target.value)} className="mt-1 h-8" /></label></div>
    {erro ? <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p> : !dados ? <p className="mt-3 text-sm text-muted-foreground">Conferindo faturamento, folha e guias cadastradas...</p> : <div className="mt-4 grid gap-3 md:grid-cols-3">{dados.itens.map(item=><div key={`${item.empresa}-${item.tipo}`} className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2"><strong className="text-sm">{item.tipo} · {item.empresa}</strong><span className={`text-xs ${item.guias ? 'text-muted-foreground' : 'text-destructive'}`}>{item.guias ? 'Guia cadastrada' : 'Falta cadastrar/apurar'}</span></div>
      <p className="mt-2 text-xs">{item.tipo==='DAS' ? 'Faturamento registrado' : item.tipo==='FGTS' ? 'FGTS na folha' : 'INSS retido na folha'}: {formatCurrency(item.referencia)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{item.aviso}</p>
      {!item.guias && <Button size="sm" variant="outline" className="mt-3" onClick={()=>onCadastrar(item)}>Cadastrar guia da competência</Button>}
    </div>)}</div>}
    <p className="mt-3 text-xs text-muted-foreground">O extrato confirma pagamentos de guias existentes ou aponta o que falta cadastrar; nunca calcula o imposto nem altera a competência.</p>
  </section>;
}