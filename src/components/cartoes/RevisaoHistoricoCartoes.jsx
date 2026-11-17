import useRevisaoHistoricoCartoes from '@/components/cartoes/useRevisaoHistoricoCartoes';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import RevisaoHistoricoLinhas from '@/components/cartoes/RevisaoHistoricoLinhas';

function mensagemSalvo(data, modo) {
  const texto = mensagemAcao(data, modo);
  if (!data.success || !data.relacionadas) return texto;
  return `${texto} A operação cobriu também ${data.relacionadas} parcela(s) ou outra(s) compra(s) do mesmo estabelecimento.${data.pendentes ? ` Ainda faltam ${data.pendentes}: salve a classificação de novo para concluir.` : ''}`;
}

function mensagemAcao(data, modo) {
  if (!data.success) return data.error;
  if (modo === 'reabrir') return data.reabertos ? `${data.reabertos} lançamento(s) reaberto(s) para revisão.` : 'Nada foi alterado: as compras já estavam abertas para revisão.';
  if (data.salvos) return `${data.salvos} lançamento(s) ${modo === 'confirmar' ? 'confirmado(s)' : 'classificado(s)'} e salvo(s).`;
  if (data.conferidos) return `${modo === 'conferir' ? '' : 'Classificação mantida; '}${data.conferidos} lançamento(s) marcado(s) como conferido(s).`;
  return 'Nada foi alterado: as compras já estavam com essa classificação.';
}

export default function RevisaoHistoricoCartoes({ mes, anual }) {
  const { dados, revisao, loading, error, feedback, mostrarTodas, setMostrarTodas, atualizar, salvo } = useRevisaoHistoricoCartoes(mes, anual);
  if (anual) return <p className="text-xs text-muted-foreground mb-4">Selecione um mês para comparar a classificação com o mês anterior.</p>;
  const r = revisao?.resumo;
  return <section className="bg-card border rounded-xl p-4 mb-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Revisão pelo mês anterior · {mes}</h2><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" aria-pressed={mostrarTodas} disabled={loading} onClick={() => setMostrarTodas(v => !v)}>{mostrarTodas ? `Só pendentes${r ? ` (${r.total_pendentes})` : ''}` : `Mostrar todas${r ? ` (${r.total_grupos})` : ''}`}</Button><Button size="sm" variant="outline" disabled={loading} onClick={() => atualizar()}>{loading ? 'Analisando...' : 'Atualizar revisão'}</Button></div></div>
    <p className="text-xs text-muted-foreground">{mostrarTodas ? 'Exibindo todas as compras, inclusive as conferidas. ' : 'Exibindo apenas pendências; grupos com classificação válida e conferida saem desta lista e continuam em “Mostrar todas”. '}Abra “Ver dados da fatura e classificação salva” para conferir data, descrição, parcelas informadas, valor e classificação de cada lançamento como estão no cartão. As sugestões do mês anterior ficam separadas e só são salvas após confirmação. “Marcar conferida” mantém a classificação salva e tira o grupo das pendências; qualquer alteração posterior reabre a conferência. Ao classificar, a mesma classificação vale automaticamente para as parcelas e as outras compras do mesmo estabelecimento em todas as faturas, inclusive quando o nome veio escrito de outra forma. Igual ao histórico não comprova a finalidade da compra.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-sm text-destructive' : 'text-sm text-success'}>{feedback.texto}</p>}
    {revisao && <>
      <p className="text-xs">Base: {revisao.mes_anterior} · {revisao.faturas} fatura(s) · {r.lancamentos || 0} compras · {formatCurrency(r.valor || 0)} (sem pagamentos e estornos).</p>
      <p className="text-xs">Categorias ausentes, genéricas ou fora do cadastro ativo: {r.pendentes_categorias || 0} lançamentos ({formatCurrency(r.valor_pendente_categorias || 0)}). Pode haver sobreposição com as pendências de quem comprou / tipo.</p>
      <p className="text-xs"><strong>{r.pendentes_eixos || 0} lançamentos com quem comprou / tipo pendente</strong> ({formatCurrency(r.valor_pendente_eixos || 0)}) · {r.divergentes || 0} grupos com diferenças · {r.historico_inconsistente || 0} grupos exigem conferência do histórico / vendedor · {r.sem_historico || 0} sem correspondência · {r.conferidos || 0} conferidos · {r.iguais || 0} iguais ao mês anterior.</p>
      {revisao.itens.length > 0 && <RevisaoHistoricoLinhas itens={revisao.itens} rotulos={dados.rotulos} disabled={loading} onSaved={(data, modo) => salvo(data, mensagemSalvo(data, modo))} />}
      {!loading && !error && !revisao.itens.length && <p role="status" className="text-sm text-muted-foreground">{r.lancamentos ? 'Nenhuma pendência de classificação ou conferência neste mês. As compras conferidas permanecem disponíveis em “Mostrar todas”.' : 'Nenhuma compra importada para revisar neste mês.'}</p>}
      {revisao.has_more && <Button variant="outline" size="sm" disabled={loading} onClick={() => atualizar(true)}>Carregar mais grupos</Button>}
    </>}
  </section>;
}