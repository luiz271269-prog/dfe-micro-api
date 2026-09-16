import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';

export default function VinculoLancamentoInfo({ lancamento, consulta }) {
  if (consulta.isPending) return <span className="text-muted-foreground">Consultando vínculos…</span>;
  if (consulta.isError) return <span className="text-destructive">Não foi possível consultar os vínculos.</span>;
  const vinculos = consulta.data?.porLancamento[lancamento.id] || [];
  const fatura = consulta.data?.faturas[lancamento.fatura_id];
  const emAberto = fatura && ['aberta', 'vencida'].includes(fatura.status) && Number(fatura.valor_total || 0) - Number(fatura.valor_pago || 0) > 0.009;
  return <div className="space-y-1 min-w-44 max-w-64 text-[10px]">
    {vinculos.length ? vinculos.map(v => <div key={v.id} className="flex items-start gap-1 text-primary"><Link2 className="w-3 h-3 shrink-0" /><span className="break-words">{v.label}</span></div>) : <p className="text-muted-foreground">{lancamento.item_compra_id ? 'Vínculo de compra não localizado' : 'Sem vínculo de compra/despesa'}</p>}
    {emAberto ? <Link to="/contas-a-pagar" className="text-primary hover:underline">Contas a Pagar: pela fatura</Link> : <p className="text-muted-foreground">{!fatura ? 'Fatura não localizada' : fatura.status === 'paga_total' ? 'Fatura quitada · fora do aberto' : 'Fatura sem saldo em aberto'}</p>}
  </div>;
}