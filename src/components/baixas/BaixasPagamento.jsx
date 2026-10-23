import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';
export default function BaixasPagamento({registro,onSubmit}) {
  const [valor,setValor]=useState(String(registro.saldo)),[data,setData]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())),[forma,setForma]=useState('pix'),[canal,setCanal]=useState(''),[motivo,setMotivo]=useState('');
  const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
  const formas=['ItemCompra','DespesaOperacional','ObraReforma'].includes(registro.tipo)?['pix','boleto','transferencia','dinheiro',...(registro.tipo==='ItemCompra'?[]:['debito_automatico'])]:registro.tipo==='FolhaPagamento'?['pix','transferencia','dinheiro','cheque','cartao','deposito']:['pix','transferencia','dinheiro','cheque','cartao','deposito','boleto','debito_automatico'];
  const nomes={pix:'PIX',boleto:'Boleto',transferencia:'Transferência',dinheiro:'Dinheiro',debito_automatico:'Débito automático',cheque:'Cheque',cartao:'Cartão',deposito:'Depósito'};
  if(registro.saldo<=0)return <p className="text-sm text-success">Obrigação sem saldo para nova baixa.</p>;
  return <form className="space-y-3" onSubmit={e=>{e.preventDefault();onSubmit({acao:'manual',valor:Number(valor),data,forma,canal,motivo},{operação:'Pagamento declarado sem conciliação',obrigação:registro.descricao,valor:formatCurrency(Number(valor)),data,forma,canal,saldo_depois:formatCurrency(registro.saldo-Number(valor))});}}>
    <p className="text-sm text-muted-foreground">Registre como foi pago. Não será criado débito bancário nem confirmada conciliação.</p>
    <div className="grid grid-cols-2 gap-3"><div><Label>Valor deste pagamento</Label><Input type="number" min="0.01" max={registro.saldo} step="0.01" value={valor} onChange={e=>setValor(e.target.value)} required/></div><div><Label>Data efetiva</Label><Input type="date" max={hoje} value={data} onChange={e=>setData(e.target.value)} required/></div></div>
    <div><Label>Instrumento / como foi pago</Label><select className="w-full border p-2 rounded-md bg-background text-sm" value={forma} onChange={e=>setForma(e.target.value)}>{formas.map(f=><option key={f} value={f}>{nomes[f]}</option>)}</select></div>
    <div><Label>Canal / conta / referência utilizada</Label><Input value={canal} maxLength={160} onChange={e=>setCanal(e.target.value)} placeholder="Identificação da conta ou canal de pagamento" required/></div>
    <div><Label>Evidência ou motivo conferido</Label><Input minLength={10} maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)} required/></div>
    <Button type="submit" disabled={registro.saldo<=0}>Revisar pagamento</Button>
  </form>;
}