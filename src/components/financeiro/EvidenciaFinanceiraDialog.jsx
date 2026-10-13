import { useEffect, useState } from 'react';
import { gerenciarEvidenciasFinanceiras } from '@/functions/gerenciarEvidenciasFinanceiras';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/formatters';
const TIPOS = ['ItemCompra','DespesaOperacional','Tributo','FolhaPagamento','FaturaCartao','ObraReforma'];
export default function EvidenciaFinanceiraDialog({ item, onClose, onSaved }) {
  const [tipo,setTipo]=useState('ItemCompra'), [dados,setDados]=useState(null), [alvo,setAlvo]=useState(''), [banco,setBanco]=useState(''), [motivo,setMotivo]=useState(''), [erro,setErro]=useState(''), [busy,setBusy]=useState(false);
  useEffect(()=>{let ativo=true;setDados(null);setAlvo('');setBanco('');setErro('');gerenciarEvidenciasFinanceiras({acao:'candidatos',evidencia_id:item.id,entidade_tipo:tipo}).then(r=>{if(ativo)setDados(r.data);}).catch(e=>{if(ativo)setErro(e.response?.data?.error || e.message);});return()=>{ativo=false;};},[item.id,tipo]);
  async function salvar(acao) {
    setBusy(true);setErro('');
    try { const r=await gerenciarEvidenciasFinanceiras({acao,evidencia_id:item.id,entidade_tipo:dados?.tipo,entidade_id:alvo,lancamento_bancario_id:banco,motivo});if(!r.data?.success)throw new Error(r.data?.error);onSaved();onClose(); }
    catch(e){setErro(e.response?.data?.error || e.message);}finally{setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Conciliar {item.direcao==='entrada'?'entrada':'saída'}</DialogTitle><DialogDescription>{item.contraparte} · {formatCurrency(item.valor)} · {item.data || item.vencimento}</DialogDescription></DialogHeader>
    <p className="text-xs text-muted-foreground">{item.tipo==='boletos_liquidados'?'A baixa exige uma parcela existente e um crédito do extrato.':'A conferência apenas identifica o documento existente; não cria obrigação nem registra pagamento.'}</p>
    {item.tipo==='dda_boletos'&&<label className="text-sm">Fonte da obrigação<select className="mt-1 w-full rounded-md border bg-background p-2" value={tipo} onChange={e=>setTipo(e.target.value)}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></label>}
    {!dados&&!erro?<p className="text-sm text-muted-foreground">Buscando documentos existentes…</p>:dados&&<>
      <label className="text-sm">Documento de origem<select className="mt-1 w-full rounded-md border bg-background p-2" value={alvo} onChange={e=>setAlvo(e.target.value)}><option value="">Selecione</option>{dados.itens.map(c=><option key={c.id} value={c.id}>{c.nome} · {c.referencia} · {formatCurrency(c.valor)} · {c.data}</option>)}</select></label>
      {!dados.itens.length&&<p className="text-sm text-warning">Nenhum documento correspondente. Revise os dados ou importe a fonte oficial; a evidência permanece pendente.</p>}
      {item.tipo==='boletos_liquidados'&&<label className="text-sm">Crédito bancário<select className="mt-1 w-full rounded-md border bg-background p-2" value={banco} onChange={e=>setBanco(e.target.value)}><option value="">Selecione</option>{dados.bancos.map(c=><option key={c.id} value={c.id}>{c.data} · {formatCurrency(c.valor)} · {c.nome}</option>)}</select>{!dados.bancos.length&&<span className="mt-1 block text-xs text-warning">Importe o extrato ou revise a data. Não há crédito elegível nesta janela.</span>}</label>}
    </>}
    <label className="text-sm">Justificativa<Input maxLength={1000} value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Descreva a conferência (mínimo 10 caracteres)" /></label>
    {erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy||motivo.trim().length<10} onClick={()=>salvar('rejeitar')}>Rejeitar evidência</Button><Button disabled={busy||!alvo||motivo.trim().length<10||(item.tipo==='boletos_liquidados'&&!banco)} onClick={()=>salvar('confirmar')}>{busy?'Registrando…':'Confirmar conciliação'}</Button></div>
  </DialogContent></Dialog>;
}