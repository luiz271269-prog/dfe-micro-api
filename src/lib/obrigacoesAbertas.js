import { base44 } from '@/api/base44Client';
import { vencimentoFolha } from '@/lib/folhaCalendario';
import { chamarBaixas } from '@/components/baixas/baixasService';
import { saldoGuia } from '@/components/tributos/tributoFluxo';

// Carrega todas as obrigações em aberto (não vinculadas ao extrato) num formato único
// { entidade_tipo, entidade_id, descricao, fornecedor, valor, data_vencimento, tipo_label }
export async function carregarObrigacoesAbertas() {
  const [despesas, tributos, faturas, cartoes, folhas, vinculos] = await Promise.all([
    base44.entities.DespesaOperacional.list('-data_vencimento', 800),
    base44.entities.Tributo.list('-data_vencimento', 500),
    base44.entities.FaturaCartao.list('-data_vencimento', 300),
    base44.entities.ContaCartao.list(),
    base44.entities.FolhaPagamento.list('-competencia', 500),
    base44.entities.VinculoExtrato.list('-created_date', 5000),
  ]);

  const vinc = new Set(vinculos.map(v => `${v.entidade_tipo}-${v.entidade_id}`));
  const lista = [];

  despesas.filter(d => d.status !== 'pago').forEach(d => {
    if (vinc.has(`DespesaOperacional-${d.id}`)) return;
    lista.push({
      entidade_tipo: 'DespesaOperacional', entidade_id: d.id, tipo_label: 'despesa',
      descricao: d.descricao, fornecedor: d.fornecedor || '—',
      valor: d.valor || 0, data_vencimento: d.data_vencimento || d.data,
    });
  });

  tributos.filter(t => ['a_vencer','vencido','parcelado'].includes(t.status) && saldoGuia(t) > 0).forEach(t => {
    lista.push({
      entidade_tipo: 'Tributo', entidade_id: t.id, tipo_label: 'tributo',
      descricao: t.descricao || `${t.tipo} ${t.competencia}`, fornecedor: 'Receita / Governo',
      valor: saldoGuia(t), data_vencimento: t.data_vencimento,
    });
  });

  faturas.filter(f => f.status === 'aberta' || f.status === 'vencida').forEach(f => {
    if (vinc.has(`FaturaCartao-${f.id}`)) return;
    const c = cartoes.find(x => x.id === f.conta_cartao_id);
    lista.push({
      entidade_tipo: 'FaturaCartao', entidade_id: f.id, tipo_label: 'fatura',
      descricao: `Fatura ${c?.nome || 'Cartão'} — ${f.mes_referencia}`, fornecedor: c?.nome || 'Cartão',
      valor: (f.valor_total || 0) - (f.valor_pago || 0), data_vencimento: f.data_vencimento,
    });
  });

  folhas.filter(f => f.status !== 'pago').forEach(f => {
    if (vinc.has(`FolhaPagamento-${f.id}`)) return;
    lista.push({
      entidade_tipo: 'FolhaPagamento', entidade_id: f.id, tipo_label: 'folha',
      descricao: `Folha ${f.competencia} — ${f.funcionario_nome}`, fornecedor: f.funcionario_nome,
      valor: f.salario_liquido || 0, data_vencimento: vencimentoFolha(f),
    });
  });

  return lista;
}

// Compatibilidade: somente a fachada central executa e audita a baixa.
export async function conciliarObrigacaoComLancamento(obrigacao, lancamento, observacao) {
  const [movimento, documento] = await Promise.all([
    base44.entities.LancamentoBancario.get(lancamento.id),
    base44.entities[obrigacao.entidade_tipo].get(obrigacao.entidade_id),
  ]);
  return chamarBaixas({ acao: 'banco', tipo: 'LancamentoBancario', id: movimento.id, versao: movimento.updated_date,
    destino: obrigacao.entidade_tipo, destino_id: documento.id, destino_versao: documento.updated_date,
    valor: Math.abs(lancamento.valor || 0), motivo: observacao || `Conciliação manual revisada na origem · ${obrigacao.descricao}`,
    pedidoId: crypto.randomUUID() });
}