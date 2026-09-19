import { Button } from '@/components/ui/button';
import { Edit, Power, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { proximaPrevisao } from '@/components/recorrentes/fixasEngine';

export default function FixaCadastroCard({ regra, sugestoes, despesas, inicio, fim, categorias, admin, onEditar, onToggle, onExcluir }) {
  const ocorrencias = sugestoes.filter(s => s.entidade_id === regra.id && s.competencia >= inicio && s.competencia <= fim);
  const confirmadas = ocorrencias.filter(s => s.status === 'confirmada');
  const legadas = despesas.filter(d => d.data?.slice(0, 7) >= inicio && d.data?.slice(0, 7) <= fim && d.status === 'pago' && d.lancamento_bancario_id && d.observacoes?.includes(`Regra recorrente ${regra.id} ·`) && !confirmadas.some(s => s.lancamento_bancario_id === d.lancamento_bancario_id));
  const divergentes = ocorrencias.filter(s => s.status === 'pendente' && s.bloqueada).length;
  const pendentes = ocorrencias.filter(s => s.status === 'pendente' && !s.bloqueada);
  const proxima = proximaPrevisao(regra, `${inicio}-01`);
  const previstas = proxima && proxima.slice(0, 7) <= fim;
  return <article className="rounded-xl border bg-card p-4 space-y-3">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold break-words">{regra.nome}</h3><p className="text-xs text-muted-foreground">{regra.empresa || 'Sem empresa'} · {regra.forma_pagamento === 'cartao' ? 'Compra no cartão' : 'Pagamento no extrato'}</p></div><p className="font-bold whitespace-nowrap tabular-nums">{formatCurrency(regra.valor_esperado)}</p></div>
    <p className="text-xs text-muted-foreground">{categorias[regra.categoria] || regra.categoria} · {{ semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual' }[regra.frequencia || 'mensal']} · dia {regra.dia_vencimento || 'não definido'}</p>
    <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1"><p>Próxima previsão a partir do período: <b>{proxima ? formatDate(proxima) : regra.is_ativa ? 'Complete dia e início' : 'Inativa'}</b></p><p>{confirmadas.length + legadas.length} ocorrência(s) confirmada(s) no período</p></div>
    <div className="flex flex-wrap gap-2 text-xs">
      {!regra.is_ativa && <span className="rounded-full bg-muted px-2 py-1">Inativa</span>}
      {regra.is_ativa && !confirmadas.length && !legadas.length && !pendentes.length && !divergentes && <span className="rounded-full bg-primary/10 text-primary px-2 py-1">{previstas ? 'Prevista · ainda não identificada' : 'Sem previsão no período'}</span>}
      {(legadas.length > 0 || confirmadas.some(s => s.canal === 'extrato')) && <span className="rounded-full bg-success/10 text-success px-2 py-1">Casada no extrato</span>}
      {confirmadas.some(s => s.canal === 'cartao') && <span className="rounded-full bg-success/10 text-success px-2 py-1">Compra no cartão confirmada</span>}
      {pendentes.some(s => s.canal === 'cartao') && <span className="rounded-full bg-warning/10 text-warning px-2 py-1">Cartão · aguardando revisão</span>}
      {pendentes.some(s => s.canal === 'extrato') && <span className="rounded-full bg-warning/10 text-warning px-2 py-1">Extrato · aguardando revisão</span>}
      {!!divergentes && <span className="rounded-full bg-destructive/10 text-destructive px-2 py-1">{divergentes} divergência(s)</span>}
    </div>
    {admin && <div className="flex gap-2 flex-wrap"><Button size="sm" variant="outline" onClick={() => onEditar(regra)}><Edit />Editar</Button><Button size="sm" variant="ghost" onClick={() => onToggle(regra)}><Power />{regra.is_ativa ? 'Desativar' : 'Ativar'}</Button><Button size="sm" variant="ghost" aria-label={`Excluir ${regra.nome}`} onClick={() => onExcluir(regra)}><Trash2 className="text-destructive" /></Button></div>}
  </article>;
}