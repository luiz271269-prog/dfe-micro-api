// Classifica cada LancamentoBancario para o regime de caixa (decisões 7, 11, 12, 13, 14, 15).
import { perimetroDaConta } from './evidencia.ts';

const VINCULO_PARA_CLASSE = {
  TituloCobranca: ['recebimento', 'recebimentos'],
  NotaFiscal: ['recebimento', 'recebimentos'],
  ItemCompra: ['pagamento_operacional', 'compras'],
  FaturaCartao: ['pagamento_operacional', 'cartao'],
  Tributo: ['pagamento_operacional', 'tributos'],
  FolhaPagamento: ['pagamento_operacional', 'folha'],
  DespesaOperacional: ['pagamento_operacional', 'despesas'],
  TransferenciaInterna: ['transferencia', 'transferencia'],
};

const CATEGORIA_PARA_CLASSE = {
  recebimento: ['recebimento', 'recebimentos'],
  fornecedor: ['pagamento_operacional', 'compras'],
  despesa_operacional: ['pagamento_operacional', 'despesas'],
  tributo: ['pagamento_operacional', 'tributos'],
  folha: ['pagamento_operacional', 'folha'],
  pro_labore: ['retirada', 'pro_labore'],
  pessoal: ['retirada', 'pessoal'],
  obras_reforma: ['investimento', 'obras'],
  financeiro: ['financeiro', 'financeiro'],
  transferencia: ['transferencia', 'transferencia'],
};

function classeDaObra(obra) {
  // decisão 12: sem natureza → investimento
  return obra?.natureza === 'manutencao' ? ['pagamento_operacional', 'despesas'] : ['investimento', 'obras'];
}

export function normalizarCaixa(dados, perimetro, hoje) {
  const vinculosPorLanc = new Map();
  for (const v of dados.VinculoExtrato) {
    if (!vinculosPorLanc.has(v.lancamento_bancario_id)) vinculosPorLanc.set(v.lancamento_bancario_id, []);
    vinculosPorLanc.get(v.lancamento_bancario_id).push(v);
  }
  const obras = new Map(dados.ObraReforma.map((o) => [o.id, o]));
  const contas = new Map(dados.LancamentoBancario.map((l) => [l.id, l.conta_bancaria]));

  // decisão 7: transferência neutralizada só quando origem e destino estão no perímetro
  const neutralizados = new Set();
  for (const t of dados.TransferenciaInterna) {
    const pOrig = perimetroDaConta(contas.get(t.lancamento_debito_id) || t.conta_origem);
    const pDest = perimetroDaConta(contas.get(t.lancamento_credito_id) || t.conta_destino);
    const ambosDentro = perimetro === 'grupo' || (pOrig === perimetro && pDest === perimetro);
    if (ambosDentro) { neutralizados.add(t.lancamento_debito_id); neutralizados.add(t.lancamento_credito_id); }
  }

  return dados.LancamentoBancario
    .filter((l) => l.data && l.data <= hoje)
    .filter((l) => perimetro === 'grupo' || perimetroDaConta(l.conta_bancaria) === perimetro)
    .map((l) => {
      let classe, sub;
      const vinc = vinculosPorLanc.get(l.id);
      if (neutralizados.has(l.id)) { [classe, sub] = ['transferencia_neutralizada', 'transferencia']; }
      else if (vinc?.length) {
        const v = vinc[0]; // decisão 15: em caixa, o vínculo manda
        [classe, sub] = v.entidade_tipo === 'ObraReforma' ? classeDaObra(obras.get(v.entidade_id)) : (VINCULO_PARA_CLASSE[v.entidade_tipo] || ['nao_classificado', 'sem_regra']);
      } else if (CATEGORIA_PARA_CLASSE[l.categoria]) { [classe, sub] = CATEGORIA_PARA_CLASSE[l.categoria]; }
      else { [classe, sub] = ['nao_classificado', l.categoria || 'sem_categoria']; }
      // crédito classificado como pagamento é inconsistente → financeiro (estorno) — decisão 13
      if (l.valor > 0 && classe === 'pagamento_operacional') { classe = 'financeiro'; sub = 'estorno'; }
      return { ...l, classe, sub, empresa_perimetro: perimetroDaConta(l.conta_bancaria) };
    });
}