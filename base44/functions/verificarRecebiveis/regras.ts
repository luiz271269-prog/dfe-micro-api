import { centavos } from '../../shared/recebimentosExtrato.ts';
import { norm } from '../../shared/evidenciaFinanceira.ts';

const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const monetario = c => real.format(c / 100);
const refNota = (tipo, numero) => `${tipo}-${String(numero).trim().replace(/^0+(?=\d)/, '')}`;
const refTitulo = t => {
  const ref = /^\s*(NF(?:-?E)?|CI)[\s-]*(\d+)(?:\/\d+)?\s*$/i.exec(t.seu_numero || '');
  return ref ? refNota(ref[1].toUpperCase() === 'CI' ? 'CI' : 'NF', ref[2]) : '';
};
const ativa = n => n.status !== 'anulada' && !n.is_espelho_ci;
const estado = s => ({ pago: 'Pago', parcial: 'Parcial', a_vencer: 'A vencer', em_aberto: 'Em aberto', vencido: 'Vencido' })[s] || s || 'Não informado';
const registro = (r, nota, grupo, regra, motivo, registrado, comparado) => ({
  chave: `${regra}:${r.id}`, grupo, registro_id: r.id,
  referencia: nota ? `${r.tipo} ${r.numero}` : `Título ${r.nosso_numero || r.seu_numero || r.id}${r.parcela_numero ? ` · parcela ${r.parcela_numero}` : ''}`,
  cliente: r.cliente || '', empresa: r.empresa || '', motivo, registrado, comparado,
});

export function criarVerificacao() {
  const notas = new Map(), refs = new Map(), achados = new Map();
  const gravar = (...args) => { const item = registro(...args); achados.set(item.chave, item); };
  function lerNota(n) {
    notas.set(n.id, { nota: n, total: 0, pago: 0, parcelas: 0, recebimentoDireto: false });
    if (ativa(n)) { const ref = refNota(n.tipo, n.numero); if (!refs.has(ref)) refs.set(ref, []); refs.get(ref).push(n); }
  }
  function lerParcela(t) {
    const previsto = centavos(t.valor_titulo), pago = centavos(t.valor_pago);
    const N = t.nota_fiscal_id && notas.get(t.nota_fiscal_id);
    if (N) { N.total += previsto; N.pago += pago; N.parcelas++; }
    const ref = refTitulo(t);
    if (t.nota_fiscal_id && (!N || !ativa(N.nota) || (t.empresa && N.nota.empresa && t.empresa !== N.nota.empresa))) {
      const motivo = !N ? 'O vínculo gravado aponta para uma nota que não existe.' : !ativa(N.nota) ? 'A parcela está vinculada a uma nota anulada ou espelho.' : 'A empresa da parcela não é a mesma da nota vinculada.';
      gravar(t, false, 'vinculo', 'vinculo_parcela', motivo, N ? `${N.nota.tipo} ${N.nota.numero} · ${N.nota.empresa || 'sem empresa'}` : t.nota_fiscal_id, ref || 'Nota ativa da mesma empresa');
    } else if (!t.nota_fiscal_id && (ref || t.fonte_modulo === 'vendas')) {
      const candidatas = (refs.get(ref) || []).filter(n => (!t.empresa || !n.empresa || n.empresa === t.empresa) && (!t.cliente || !n.cliente || norm(t.cliente) === norm(n.cliente)));
      const motivo = candidatas.length > 1 ? 'Há mais de uma nota ativa compatível; nenhum vínculo foi escolhido.' : candidatas.length === 1 ? 'Existe uma nota compatível, mas a parcela não está vinculada.' : 'A parcela tem referência de venda, mas não foi encontrada uma nota ativa compatível.';
      gravar(t, false, 'vinculo', 'vinculo_parcela', motivo, ref || 'Sem referência de nota', `${candidatas.length} nota(s) compatível(is)`);
    }
    if (pago < 0 || pago > previsto) gravar(t, false, 'valor_pago', 'valor_parcela', 'O valor pago registrado está fora do intervalo entre zero e o valor da parcela.', monetario(pago), monetario(previsto));
    const quitada = pago > 0 && previsto - pago <= 1;
    if (quitada !== (t.status === 'pago')) gravar(t, false, 'status', 'status_parcela', `O status da parcela não corresponde ao valor recebido (${monetario(pago)} de ${monetario(previsto)}).`, estado(t.status), quitada ? 'Pago' : 'Em aberto ou vencido');
  }
  function concluir() {
    for (const { nota: n, total, pago: parcelasPagas, parcelas, recebimentoDireto } of notas.values()) {
      if (!ativa(n)) continue;
      const previsto = centavos(n.valor_total), pago = centavos(n.valor_recebido), saldo = Math.max(0, previsto - pago);
      if (parcelas && total !== previsto) gravar(n, true, 'total_parcelas', 'total_nota', `A soma das ${parcelas} parcela(s) vinculada(s) não fecha com o total da nota.`, monetario(previsto), monetario(total));
      if (pago < 0 || pago > previsto) gravar(n, true, 'valor_pago', 'valor_nota', 'O valor recebido registrado está fora do intervalo entre zero e o valor da nota.', monetario(pago), monetario(previsto));
      if (parcelas && !recebimentoDireto && pago !== parcelasPagas) gravar(n, true, 'valor_pago', 'pago_nota_parcelas', 'O valor recebido na nota não confere com a soma das parcelas recebidas.', monetario(pago), monetario(parcelasPagas));
      if (n.valor_aberto != null && centavos(n.valor_aberto) !== saldo) gravar(n, true, 'valor_pago', 'saldo_nota', 'O saldo em aberto não corresponde ao total da nota menos o recebimento registrado.', monetario(centavos(n.valor_aberto)), monetario(saldo));
      const esperados = pago > 0 ? [saldo <= 1 ? 'pago' : 'parcial'] : ['a_vencer', 'vencido'];
      if (previsto > 0 && !esperados.includes(n.status)) gravar(n, true, 'status', 'status_nota', `O status da nota não corresponde ao valor recebido (${monetario(pago)} de ${monetario(previsto)}).`, estado(n.status), esperados.map(estado).join(' ou '));
    }
    return achados;
  }
  return { lerNota, lerParcela, marcarDireto(id) { const linha = notas.get(id); if (linha) linha.recebimentoDireto = true; }, concluir };
}