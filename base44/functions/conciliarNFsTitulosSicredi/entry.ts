import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Conciliação NF ↔ TituloCobranca (Sicredi) após importar o Relatório de Vendas Diário do Elite.
//
// PROBLEMA: O relatório do Elite gera DUAS entidades por venda:
//   1. NotaFiscal (cabeçalho — NF-180, valor total, vendedor, cliente)
//   2. TituloCobranca (1 por parcela — 180/1, 180/2, com vencimento Sicredi)
//
// Os dois lados ficam soltos no banco. Esta função:
//   a) Vincula cada TituloCobranca à sua NotaFiscal (via seu_numero=NF-XXX)
//   b) Recalcula valor_recebido / valor_aberto / status da NF a partir dos títulos
//   c) Atualiza a data_vencimento_proxima da NF para a próxima parcela em aberto
//
// REGRA: Não cria nada novo — só RECONCILIA o que já existe.

function calcStatus(valorTotal, valorRecebido, proximaVenc, hoje) {
  const TOL = 0.02;
  if (Math.abs(valorTotal - valorRecebido) <= TOL) return 'pago';
  if (valorRecebido > TOL) return 'parcial';
  if (proximaVenc && proximaVenc < hoje) return 'vencido';
  return 'a_vencer';
}

function extrairNumeroNF(seuNumero) {
  if (!seuNumero) return null;
  // "NF-180" → "180" | "CI-100084" → "100084" | "180" → "180"
  const m = String(seuNumero).match(/(?:NF|CI)?-?\s*(\w+)/i);
  return m ? m[1].trim() : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;

    const [notas, titulos] = await Promise.all([
      svc.NotaFiscal.list('-data_emissao', 2000),
      svc.TituloCobranca.list('-data_vencimento', 5000),
    ]);

    // Index: número da NF → registro
    const idxNotaPorNum = {};
    notas.forEach(n => {
      const key = `${n.tipo}-${String(n.numero).trim()}`;
      idxNotaPorNum[key] = n;
    });

    // Agrupa títulos por NF/CI pai
    const titulosPorNota = {};
    titulos.forEach(t => {
      const num = extrairNumeroNF(t.seu_numero);
      if (!num) return;
      // Tenta NF e CI (não sabemos qual o título referencia sem prefixo)
      const tipo = /^CI/i.test(t.seu_numero) ? 'CI' : 'NF';
      const key = `${tipo}-${num}`;
      if (!titulosPorNota[key]) titulosPorNota[key] = [];
      titulosPorNota[key].push(t);
    });

    const hoje = new Date().toISOString().split('T')[0];
    let nfsAtualizadas = 0;
    let titulosVinculados = 0;
    const semNF = [];

    // Throttle: aguarda N ms entre chamadas para não estourar rate limit
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const THROTTLE_MS = 60;

    for (const [key, tits] of Object.entries(titulosPorNota)) {
      const nf = idxNotaPorNum[key];
      if (!nf) {
        semNF.push({ key, qtd: tits.length });
        continue;
      }

      const valorTotal = nf.valor_total || 0;
      const valorRecebido = tits.reduce((s, t) => s + (t.valor_pago || 0), 0);
      const valorAberto = Math.max(0, valorTotal - valorRecebido);

      const titulosEmAberto = tits.filter(t => t.status !== 'pago' && t.data_vencimento);
      const proximaVenc = titulosEmAberto
        .map(t => t.data_vencimento)
        .sort()[0] || null;

      const novoStatus = calcStatus(valorTotal, valorRecebido, proximaVenc, hoje);
      const canalMaisFrequente = (() => {
        const cont = {};
        tits.forEach(t => { if (t.canal_cobranca) cont[t.canal_cobranca] = (cont[t.canal_cobranca] || 0) + 1; });
        return Object.entries(cont).sort((a, b) => b[1] - a[1])[0]?.[0] || nf.canal_cobranca || 'sicredi';
      })();

      // Só atualiza se algo mudou
      const mudou =
        Math.abs((nf.valor_recebido || 0) - valorRecebido) > 0.01 ||
        Math.abs((nf.valor_aberto || 0) - valorAberto) > 0.01 ||
        nf.status !== novoStatus ||
        nf.data_vencimento_proxima !== proximaVenc ||
        nf.canal_cobranca !== canalMaisFrequente;

      if (mudou) {
        try {
          await svc.NotaFiscal.update(nf.id, {
            valor_recebido: Math.round(valorRecebido * 100) / 100,
            valor_aberto: Math.round(valorAberto * 100) / 100,
            status: novoStatus,
            data_vencimento_proxima: proximaVenc,
            canal_cobranca: canalMaisFrequente,
          });
          nfsAtualizadas++;
          await sleep(THROTTLE_MS);
        } catch (err) {
          console.warn('Erro update NF', nf.id, err.message);
        }
      }

      // Vincular títulos sem nota_fiscal_id ao id da NF
      for (const t of tits) {
        if (!t.nota_fiscal_id || t.nota_fiscal_id !== nf.id) {
          try {
            await svc.TituloCobranca.update(t.id, { nota_fiscal_id: nf.id });
            titulosVinculados++;
            await sleep(THROTTLE_MS);
          } catch (err) {
            console.warn('Erro update título', t.id, err.message);
          }
        }
      }
    }

    return Response.json({
      success: true,
      notas_atualizadas: nfsAtualizadas,
      titulos_vinculados: titulosVinculados,
      grupos_sem_nf: semNF.length,
      detalhe_sem_nf: semNF.slice(0, 20),
    });
  } catch (error) {
    console.error('Erro conciliação NF×Sicredi:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});