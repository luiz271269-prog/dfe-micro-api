import { useEffect, useRef, useState } from 'react';
import { revisarClassificacaoCartoes } from '@/functions/revisarClassificacaoCartoes';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import RevisaoHistoricoLinhas from '@/components/cartoes/RevisaoHistoricoLinhas';
export default function RevisaoHistoricoCartoes({ mes, anual }) {
  const mesAtual = useRef(mes); mesAtual.current = mes;
  const [dados, setDados] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  useEffect(() => { let active = true; setDados(null); setLoading(true); setError(''); setFeedback(null);
    if (anual) { setLoading(false); return; }
    revisarClassificacaoCartoes({ meses: [mes] }).then(({ data }) => { if (active) setDados(data); }).catch(e => { if (active) setError(e.response?.data?.error || e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mes, anual]);
  async function atualizar(mais = false) {
    const mesPedido = mes;
    setLoading(true); setError('');
    try { const { data } = await revisarClassificacaoCartoes({ meses: [mes], offset: mais ? dados.revisoes[0].next_offset : 0 });
      if (mesAtual.current !== mesPedido) return;
      setDados(prev => mais ? { ...data, revisoes: [{ ...data.revisoes[0], itens: [...prev.revisoes[0].itens, ...data.revisoes[0].itens] }] } : data);
    } catch (e) { if (mesAtual.current === mesPedido) setError(e.response?.data?.error || e.message); } finally { if (mesAtual.current === mesPedido) setLoading(false); }
  }
  async function salvo(data, modo) {
    if (mesAtual.current !== mes) return;
    setFeedback({ error: !data.success, texto: data.success ? `${data.salvos} lançamento(s) ${modo === 'confirmar' ? 'confirmado(s)' : 'classificado(s)'} e salvo(s).` : data.error });
    window.dispatchEvent(new Event('neuralfinRefresh'));
    await atualizar();
  }
  if (anual) return <p className="text-xs text-muted-foreground mb-4">Selecione um mês para comparar a classificação com o mês anterior.</p>;
  const revisao = dados?.revisoes[0], r = revisao?.resumo;
  return <section className="bg-card border rounded-xl p-4 mb-5 space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Revisão pelo mês anterior · {mes}</h2><Button size="sm" variant="outline" disabled={loading} onClick={() => atualizar()}>{loading ? 'Analisando...' : 'Atualizar revisão'}</Button></div>
    <p className="text-xs text-muted-foreground">Abra “Ver dados da fatura e classificação salva” para conferir data, descrição, parcelas informadas, valor e classificação de cada lançamento como estão no cartão. As sugestões do mês anterior ficam separadas e só são salvas após confirmação. As ações continuam limitadas ao grupo desta fatura; igual ao histórico não comprova a finalidade da compra.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-sm text-destructive' : 'text-sm text-success'}>{feedback.texto}</p>}
    {revisao && <>
      <p className="text-xs">Base: {revisao.mes_anterior} · {revisao.faturas} fatura(s) · {r.lancamentos || 0} compras · {formatCurrency(r.valor || 0)} (sem pagamentos e estornos).</p>
      <p className="text-xs">Categorias ausentes, genéricas ou fora do cadastro ativo: {r.pendentes_categorias || 0} lançamentos ({formatCurrency(r.valor_pendente_categorias || 0)}). Pode haver sobreposição com as pendências de quem comprou / tipo.</p>
      <p className="text-xs"><strong>{r.pendentes_eixos || 0} lançamentos com quem comprou / tipo pendente</strong> ({formatCurrency(r.valor_pendente_eixos || 0)}) · {r.divergentes || 0} grupos com diferenças · {r.historico_inconsistente || 0} grupos exigem conferência do histórico / vendedor · {r.sem_historico || 0} sem correspondência.</p>
      {revisao.itens.length ? <RevisaoHistoricoLinhas itens={revisao.itens} rotulos={dados.rotulos} disabled={loading} onSaved={salvo} /> : <p className="text-sm text-muted-foreground">Nenhuma compra importada para revisar neste mês.</p>}
      {revisao.has_more && <Button variant="outline" size="sm" disabled={loading} onClick={() => atualizar(true)}>Carregar mais grupos</Button>}
    </>}
  </section>;
}