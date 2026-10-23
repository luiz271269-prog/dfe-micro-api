import { useRef,useState } from 'react';
import { chamarBaixas,fontesBaixas } from '@/components/baixas/baixasService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';
import BaixasCandidato from '@/components/baixas/BaixasCandidato';
export default function BaixasCandidatos({registro,onSubmit}) {
  const cartao=registro.tipo==='LancamentoCartao',tipos=cartao?['ItemCompra','DespesaOperacional','ObraReforma']:['ItemCompra','DespesaOperacional','Tributo','FolhaPagamento','FaturaCartao','ObraReforma'];
  const [destino,setDestino]=useState(cartao?'ItemCompra':'DespesaOperacional'),[busca,setBusca]=useState(''),[rows,setRows]=useState([]),[page,setPage]=useState({}),[busy,setBusy]=useState(false),[erro,setErro]=useState(''),[sel,setSel]=useState(null),[valor,setValor]=useState(''),[motivo,setMotivo]=useState('');const seq=useRef(0);
  async function buscar(mais=false){const n=++seq.current;setBusy(true);setErro('');setSel(null);try{const p=await chamarBaixas({acao:'candidatos',tipo:registro.tipo,id:registro.id,destino,busca,cursor:mais?page.next_cursor:undefined});if(n!==seq.current)return;setRows(prev=>mais?[...prev,...p.items]:p.items);setPage(p);}catch(e){setErro(e.response?.data?.error||e.message);}finally{if(n===seq.current)setBusy(false);}}
  function mudarDestino(v){seq.current++;setDestino(v);setRows([]);setPage({});setSel(null);setBusy(false);}
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">{cartao?'Reconhecer a compra no cartão não quita a fatura.':'Selecione uma obrigação existente e confira o débito antes de alocar.'}</p>
    <div><Label>Módulo da obrigação</Label><select className="w-full border p-2 rounded-md bg-background text-sm" value={destino} onChange={e=>mudarDestino(e.target.value)}>{tipos.map(t=><option key={t} value={t}>{fontesBaixas[t]}</option>)}</select></div>
    <div className="flex gap-2"><Input placeholder="Refinar por descrição ou contraparte" value={busca} onChange={e=>{setBusca(e.target.value);setSel(null);}}/><Button onClick={()=>buscar()} disabled={busy}>{busy?'Buscando...':'Buscar evidências'}</Button></div>
    <p className="text-xs text-muted-foreground">Busca em todas as datas do módulo escolhido. A similaridade indica razões de comparação, nunca autoriza baixa automática.</p>{erro&&<p className="text-destructive text-sm">{erro}</p>}
    {page.items&&<p className="text-xs text-muted-foreground">{page.aviso} {rows.length===0?'Nenhum candidato: revise o módulo, a busca ou o documento de origem.':''}</p>}
    <div className="space-y-3 max-h-[450px] overflow-y-auto">{rows.map(c=><BaixasCandidato key={c.id} c={c} selecionado={sel?.id===c.id} onSelect={r=>{setSel(r);setValor(String(Math.min(registro.saldo,r.saldo)));}}/>)}</div>
    {page.has_more&&<Button variant="outline" onClick={()=>buscar(true)} disabled={busy}>Procurar na próxima página</Button>}
    {sel&&<form className="space-y-3 border-t pt-3" onSubmit={e=>{e.preventDefault();onSubmit({acao:cartao?'cartao':'banco',destino:sel.tipo,destino_id:sel.id,destino_versao:sel.versao,valor:Number(valor),motivo},{operação:cartao?'Reconhecer compra no cartão':'Conciliar débito bancário',movimento:registro.descricao,obrigação:sel.descricao,valor:formatCurrency(cartao?sel.total:Number(valor)),saldo_da_obrigação:formatCurrency(sel.saldo),saldo_do_movimento:formatCurrency(registro.saldo)});}}>{!cartao&&<div><Label>Valor a alocar</Label><Input type="number" min="0.01" max={Math.min(registro.saldo,sel.saldo)} step="0.01" value={valor} required onChange={e=>setValor(e.target.value)}/></div>}<div><Label>Evidência conferida / motivo</Label><Input minLength={10} maxLength={500} required value={motivo} onChange={e=>setMotivo(e.target.value)}/></div><Button>Revisar vínculo individual</Button></form>}
  </div>;
}