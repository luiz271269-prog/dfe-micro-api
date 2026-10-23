import { useEffect, useRef, useState } from 'react';
import { chamarBaixas } from '@/components/baixas/baixasService';
import BaixasCandidato from '@/components/baixas/BaixasCandidato';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';

export default function BaixasMovimentos({ registro, onSubmit, contexto = {} }) {
  const [canal, setCanal] = useState(contexto.canal || 'banco'), [referencia, setReferencia] = useState(contexto.movimento_id || '');
  const [busca, setBusca] = useState(''), [mes, setMes] = useState(''), [rows, setRows] = useState([]), [page, setPage] = useState({});
  const [busy, setBusy] = useState(false), [erro, setErro] = useState(''), [sel, setSel] = useState(null), [valor, setValor] = useState(''), [motivo, setMotivo] = useState('');
  const seq = useRef(0), cartao = canal === 'cartao';
  async function buscar(mais = false) {
    const n = ++seq.current; setBusy(true); setErro(''); setSel(null); if (!mais) setRows([]);
    try { const p = await chamarBaixas({ acao: 'movimentos', tipo: registro.tipo, id: registro.id, canal, movimento_id: referencia || undefined, busca, mes, cursor: mais ? page.next_cursor : undefined }); if (n !== seq.current) return; setRows(prev => mais ? [...prev, ...p.items] : p.items); setPage(p); }
    catch (e) { if (n === seq.current) setErro(e.response?.data?.error || e.message); }
    finally { if (n === seq.current) setBusy(false); }
  }
  useEffect(() => { buscar(); return () => { seq.current++; }; }, [canal, referencia]);
  function revisar(e) {
    e.preventDefault();
    onSubmit({ acao: cartao ? 'cartao' : 'banco', tipo: sel.tipo, id: sel.id, versao: sel.versao, destino: registro.tipo, destino_id: registro.id, destino_versao: registro.versao, valor: Number(valor), motivo }, { operação: cartao ? 'Reconhecer compra no cartão' : 'Conciliar débito bancário', documento: registro.descricao, evidência: sel.descricao, valor: formatCurrency(cartao ? registro.total : Number(valor)), saldo_do_documento: formatCurrency(registro.saldo), disponível_no_movimento: formatCurrency(sel.saldo) });
  }
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Compare este documento com o pagamento existente, sem sair da tela. {cartao && 'Reconhecer a compra no cartão não paga a fatura.'}</p>
    <div className="flex flex-wrap gap-2"><Button variant={!cartao ? 'default' : 'outline'} onClick={() => { setReferencia(''); setCanal('banco'); }}>Extrato bancário</Button>{['ItemCompra','DespesaOperacional','ObraReforma'].includes(registro.tipo) && <Button variant={cartao ? 'default' : 'outline'} onClick={() => { setReferencia(''); setCanal('cartao'); }}>Compra no cartão</Button>}</div>
    {referencia && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">Evidência indicada pela tela de origem.<Button size="sm" variant="outline" onClick={() => setReferencia('')}>Buscar outras evidências</Button></div>}
    <div className="flex flex-wrap gap-2"><Input className="min-w-40 flex-1" aria-label="Buscar evidência" placeholder="Descrição, estabelecimento ou conta" value={busca} onChange={e => { setBusca(e.target.value); setSel(null); }}/><Input className="w-40" type="month" aria-label="Mês da evidência (opcional)" value={mes} onChange={e => { setMes(e.target.value); setSel(null); }}/><Button disabled={busy} onClick={() => buscar()}>{busy ? 'Analisando...' : 'Analisar evidências'}</Button></div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <p className="text-xs text-muted-foreground">{page.aviso || 'Análise sem alteração dos documentos.'}</p>
    {!busy && page.items && !rows.length && <p className="text-sm text-muted-foreground">Nenhuma evidência disponível neste recorte.</p>}
    <div className="max-h-80 space-y-3 overflow-y-auto">{rows.map(c => <BaixasCandidato key={c.id} c={c} selecionado={sel?.id === c.id} rotulo="Selecionar evidência" onSelect={r => { setSel(r); setValor(String(Math.min(registro.saldo, r.saldo))); }}/>)}</div>
    {page.has_more && <Button variant="outline" disabled={busy} onClick={() => buscar(true)}>Carregar mais evidências</Button>}
    {sel && <form onSubmit={revisar} className="space-y-3 border-t pt-3">{!cartao && <div><Label>Valor a conciliar</Label><Input type="number" min="0.01" max={Math.min(registro.saldo, sel.saldo)} step="0.01" required value={valor} onChange={e => setValor(e.target.value)}/></div>}<div><Label>Evidência conferida / motivo</Label><Input minLength={10} maxLength={500} required value={motivo} onChange={e => setMotivo(e.target.value)}/></div><Button disabled={busy}>Revisar conciliação</Button></form>}
  </div>;
}