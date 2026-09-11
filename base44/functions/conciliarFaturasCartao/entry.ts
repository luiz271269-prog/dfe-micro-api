import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const perto = (a, b, dias = 14) => a && b && Math.abs(Date.parse(a) - Date.parse(b)) <= dias * 86400000;
function nomeBate(descricao, cartao) {
  const texto = norm(descricao);
  const termos = [cartao?.nome, cartao?.bandeira, cartao?.titular].flatMap(v => norm(v).replace(/—/g, ' ').split(/\s+/)).filter(v => v.length >= 4);
  return termos.some(v => texto.includes(v)) || (norm(cartao?.bandeira) === 'MAGALU' && (texto.includes('LUIZACRED') || texto.includes('MAGALU')));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { dry_run = false } = await req.json().catch(() => ({}));
    const db = base44.entities;
    const [cartoes, faturas, bancos, itensCartao, vinculos] = await Promise.all([
      db.ContaCartao.list('id', 500), db.FaturaCartao.list('id', 1000), db.LancamentoBancario.list('-data', 5000), db.LancamentoCartao.list('id', 5000), db.VinculoExtrato.list('id', 5000),
    ]);
    const cartaoPorId = new Map(cartoes.map(c => [c.id, c]));
    const itensPorFatura = new Map();
    for (const item of itensCartao) {
      if (!itensPorFatura.has(item.fatura_id)) itensPorFatura.set(item.fatura_id, []);
      itensPorFatura.get(item.fatura_id).push(item);
    }
    const alocadoBanco = new Map();
    for (const v of vinculos) alocadoBanco.set(v.lancamento_bancario_id, (alocadoBanco.get(v.lancamento_bancario_id) || 0) + Math.abs(v.valor_alocado || 0));
    const vinculosFatura = vinculos.filter(v => v.entidade_tipo === 'FaturaCartao');
    const pagosPorFatura = new Map();
    for (const v of vinculosFatura) pagosPorFatura.set(v.entidade_id, (pagosPorFatura.get(v.entidade_id) || 0) + Math.abs(v.valor_alocado || 0));
    const abertas = faturas.filter(f => f.status !== 'paga_total' || !(pagosPorFatura.get(f.id) > 0));
    const detalhes = [];
    const novosVinculos = [];
    const updatesFatura = [];
    const updatesBanco = new Map();
    for (const fat of abertas) {
      const cartao = cartaoPorId.get(fat.conta_cartao_id);
      if (!cartao) continue;
      const itens = itensPorFatura.get(fat.id) || [];
      const somaReal = itens.reduce((total, item) => total + (item.valor || 0), 0);
      const valorFatura = somaReal > 0.01 ? somaReal : (fat.valor_total || 0);
      const pagoAnterior = pagosPorFatura.get(fat.id) || 0;
      const saldo = Math.max(0, valorFatura - pagoAnterior);
      if (saldo <= 0.01) continue;
      const contaEsperada = norm(cartao.conta_bancaria_pagamento).split(' ')[0];
      const candidatos = bancos.filter(l => {
        if (!(l.valor < 0) || !perto(l.data, fat.data_vencimento)) return false;
        const disponivel = Math.abs(l.valor) - (alocadoBanco.get(l.id) || 0);
        if (disponivel <= 0.01) return false;
        const contaBate = !contaEsperada || norm(l.conta_bancaria).includes(contaEsperada);
        return contaBate || nomeBate(`${l.descricao} ${l.detalhe}`, cartao);
      });
      const tolerancia = Math.max(10, saldo * 0.05);
      let escolhidos = [];
      let melhorDiferenca = Infinity;
      for (const lanc of candidatos) {
        const disponivel = Math.abs(lanc.valor) - (alocadoBanco.get(lanc.id) || 0);
        const diferenca = Math.abs(disponivel - saldo);
        if (diferenca <= tolerancia && diferenca < melhorDiferenca) { escolhidos = [lanc]; melhorDiferenca = diferenca; }
      }
      const pool = candidatos.slice(0, 25);
      if (!escolhidos.length) {
        outer: for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
          const soma = [pool[i], pool[j]].reduce((s, l) => s + Math.abs(l.valor) - (alocadoBanco.get(l.id) || 0), 0);
          if (Math.abs(soma - saldo) <= tolerancia) { escolhidos = [pool[i], pool[j]]; break outer; }
        }
      }
      if (!escolhidos.length) continue;
      let restante = saldo;
      let novoPago = pagoAnterior;
      for (const lanc of escolhidos) {
        const disponivel = Math.max(0, Math.abs(lanc.valor) - (alocadoBanco.get(lanc.id) || 0));
        const valor = Math.min(disponivel, restante);
        if (valor <= 0.01) continue;
        novosVinculos.push({ lancamento_bancario_id: lanc.id, entidade_tipo: 'FaturaCartao', entidade_id: fat.id, valor_alocado: valor, tipo_vinculo: valor + 0.01 >= saldo && pagoAnterior === 0 ? 'pagamento_integral' : 'pagamento_parcial', conciliado_por: 'auto', confianca: Math.abs(valor - saldo) <= 0.01 ? 95 : 85 });
        alocadoBanco.set(lanc.id, (alocadoBanco.get(lanc.id) || 0) + valor);
        restante -= valor;
        novoPago += valor;
        updatesBanco.set(lanc.id, { id: lanc.id, status_conciliacao: Math.abs(lanc.valor) - (alocadoBanco.get(lanc.id) || 0) <= 0.01 ? 'conciliado' : 'parcial', vinculos_count: (lanc.vinculos_count || 0) + 1, valor_conciliado: alocadoBanco.get(lanc.id) || 0 });
      }
      const quitada = valorFatura - novoPago <= 0.01;
      updatesFatura.push({ id: fat.id, valor_total: valorFatura, valor_pago: novoPago, status: quitada ? 'paga_total' : 'aberta', data_pagamento: escolhidos.map(l => l.data).sort().pop(), lancamento_bancario_id: escolhidos.length === 1 && pagoAnterior === 0 ? escolhidos[0].id : null });
      detalhes.push({ fatura_id: fat.id, cartao: cartao.nome, mes: fat.mes_referencia, valor_fatura: valorFatura, pago_anterior: pagoAnterior, valor_pago: novoPago, saldo_restante: Math.max(0, valorFatura - novoPago), status: quitada ? 'paga_total' : 'parcial' });
    }
    if (!dry_run) {
      if (novosVinculos.length) await db.VinculoExtrato.bulkCreate(novosVinculos);
      if (updatesFatura.length) await db.FaturaCartao.bulkUpdate(updatesFatura);
      if (updatesBanco.size) await db.LancamentoBancario.bulkUpdate([...updatesBanco.values()]);
    }
    return Response.json({ sucesso: true, dry_run, faturas_avaliadas: abertas.length, conciliados: updatesFatura.length, atualizadas_pagas: updatesFatura.filter(f => f.status === 'paga_total').length, vinculos_criados: novosVinculos.length, detalhes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}