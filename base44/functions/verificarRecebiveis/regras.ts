import { centavos } from '../../shared/recebimentosExtrato.ts';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dinheiro = c => brl.format(c / 100);

export function criarVerificacao() {
  const notas = new Map();
  function lerNota(n) {
    if (n.tipo === 'NF' && n.status !== 'anulada' && !n.is_espelho_ci) notas.set(n.id, { nota: n, soma: 0, parcelas: 0 });
  }
  function lerParcela(t) {
    const item = notas.get(t.nota_fiscal_id);
    if (item) { item.soma += centavos(t.valor_titulo); item.parcelas++; }
  }
  function concluir() {
    const achados = new Map();
    for (const { nota, soma, parcelas } of notas.values()) {
      const total = centavos(nota.valor_total);
      if (soma === total) continue;
      const chave = `total_nota:${nota.id}`;
      achados.set(chave, {
        chave, grupo: 'total_parcelas', registro_id: nota.id, referencia: `NF ${nota.numero}`,
        cliente: nota.cliente || '', empresa: nota.empresa || '', registrado: dinheiro(total), comparado: dinheiro(soma),
        motivo: parcelas ? `${parcelas} parcela(s) vinculada(s); a soma não fecha com o total da nota.` : 'Nenhuma parcela vinculada à nota.',
      });
    }
    return achados;
  }
  return { lerNota, lerParcela, concluir };
}