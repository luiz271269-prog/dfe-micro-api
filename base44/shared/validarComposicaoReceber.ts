import { norm } from './evidenciaFinanceira.ts';
import { centavos } from './recebimentosExtrato.ts';

export function erroComposicaoReceber(nota, parcelas) {
  const ref = `${nota.tipo}-${nota.numero}`;
  if (nota.status === 'anulada' || nota.is_espelho_ci) return `${ref}: use a nota de origem ativa.`;
  const numeros = new Set(), boletos = new Set();
  let soma = 0;
  for (const t of parcelas) {
    const ordem = Number(t.parcela_numero), quantidade = Number(t.parcela_total), boleto = norm(t.nosso_numero);
    if (!Number.isSafeInteger(ordem) || ordem < 1 || ordem > parcelas.length || quantidade !== parcelas.length || numeros.has(ordem) || !boleto || boletos.has(boleto)) return `${ref}: a quantidade e a numeração das parcelas devem corresponder à origem, sem duplicatas.`;
    if (!Number.isFinite(t.valor_titulo) || centavos(t.valor_titulo) <= 0 || norm(t.cliente) !== norm(nota.cliente) || (t.empresa && nota.empresa && t.empresa !== nota.empresa) || !t.data_vencimento || t.data_vencimento < nota.data_emissao) return `${ref}: há parcela com valor, cliente, empresa ou vencimento incompatível.`;
    numeros.add(ordem); boletos.add(boleto);
    soma += centavos(t.valor_titulo);
  }
  return soma !== centavos(nota.valor_total) ? `${ref}: a soma das parcelas (${(soma / 100).toFixed(2)}) deve ser igual ao total da nota (${Number(nota.valor_total).toFixed(2)}).` : null;
}

export async function conferirNovoVinculoReceber(db, nota, candidatos) {
  const page = await db.TituloCobranca.filter({ nota_fiscal_id: nota.id }, { limit: 100 });
  if (page.has_more) return 'Quantidade de parcelas excede o limite da conferência.';
  const parcelas = [...new Map([...page.items, ...candidatos].map(t => [t.id,t])).values()];
  return erroComposicaoReceber(nota, parcelas);
}