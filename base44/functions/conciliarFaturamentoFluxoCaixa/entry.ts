import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { direcaoBanco } from '../../shared/direcaoFinanceira.ts';

// Concilia Faturamento (Notas Fiscais) ↔ Fluxo de Caixa (previsão vs realizado).
// REGRAS:
//   - FluxoCaixa com origem_tipo='nota_fiscal', status='previsto' e sem lancamento_bancario_id
//   - Procura créditos no extrato que validam a previsão de recebimento
//   - MATCH PERFEITO (mesmo valor ±R$0,50, data dentro de ±3 dias) → marca como 'realizado'
//   - VALOR PRÓXIMO mas data divergente (±15 dias) → marca como 'confirmado' (recebeu, mas com atraso)
//   - Atualiza valor_realizado e lancamento_bancario_id no FluxoCaixa
//   - Também atualiza valor_recebido na NotaFiscal de origem

function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function clienteNoExtrato(cliente, descricao) {
  if (!cliente || !descricao) return false;
  const c = norm(cliente);
  const d = norm(descricao);
  if (!c || !d) return false;
  const partes = c.split(' ').filter(p => p.length >= 4);
  if (partes.length === 0) return false;
  return partes.some(p => d.includes(p));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    if (body.validate_only) return Response.json({success:true,direcao:'entrada'});

    const [fluxos, lancamentos, notas, vinculos] = await Promise.all([
      svc.FluxoCaixa.filter({ origem_tipo: 'nota_fiscal' }),
      svc.LancamentoBancario.list('-data', 5000),
      svc.NotaFiscal.list('-data_emissao', 2000),
      svc.VinculoExtrato.list('-created_date', 5000),
    ]);

    // Fluxos de nota fiscal que ainda são previsão (não realizados)
    const fluxosPrevistos = fluxos.filter(f =>
      f.status === 'previsto' && !f.lancamento_bancario_id
    );

    const lancsVinculados = new Set(vinculos.map(v => v.lancamento_bancario_id));

    const creditos = lancamentos.filter(l =>
      direcaoBanco(l) === 'entrada' &&
      l.status_conciliacao !== 'conciliado' &&
      l.categoria !== 'transferencia' &&
      l.categoria !== 'interno' &&
      !lancsVinculados.has(l.id)
    );

    const TOL_VALOR = 0.50;
    const JANELA_REALIZADO = 3;
    const JANELA_CONFIRMADO = 15;

    let realizados = 0;
    let confirmados = 0;
    let semMatch = 0;
    const lancsUsados = new Set();
    const detalhes = [];

    for (const fluxo of fluxosPrevistos) {
      const valorPrevisto = fluxo.valor_previsto || 0;
      if (valorPrevisto < 0.01) { semMatch++; continue; }
      const dataPrevista = new Date(fluxo.data_prevista);

      // Busca nota fiscal de origem para enriquecer match
      const nf = notas.find(n => n.id === fluxo.origem_id);

      const candidatos = creditos
        .filter(l => {
          if (lancsUsados.has(l.id)) return false;
          if (Math.abs(l.valor - valorPrevisto) > TOL_VALOR) return false;
          const diff = Math.abs((new Date(l.data) - dataPrevista) / 86400000);
          return diff <= JANELA_CONFIRMADO;
        })
        .map(l => {
          const diff = Math.abs((new Date(l.data) - dataPrevista) / 86400000);
          const nomeMatch = nf ? clienteNoExtrato(nf.cliente, l.descricao) : false;
          return { l, diff, nomeMatch };
        })
        .sort((a, b) => {
          if (a.nomeMatch !== b.nomeMatch) return a.nomeMatch ? -1 : 1;
          return a.diff - b.diff;
        });

      if (candidatos.length === 0) { semMatch++; continue; }

      const { l: match, diff, nomeMatch } = candidatos[0];
      const isRealizado = diff <= JANELA_REALIZADO;
      const novoStatus = isRealizado ? 'realizado' : 'confirmado';

      try {
        if (!nf || !nomeMatch || candidatos.length !== 1) { semMatch++; continue; }
        const resposta = await base44.functions.invoke('vincularExtrato', {
          acao:'criar', entidade_tipo:'NotaFiscal', entidade_id:nf.id,
          lancamento_bancario_id:match.id, valor_alocado:match.valor,
          tipo_vinculo:'recebimento_parcial', conciliado_por:'auto',
          observacao:`Entrada · previsão ${fluxo.id} · ${nf.cliente}`,
        });
        if (!resposta.data?.success) throw new Error(resposta.data?.error || 'Recebimento não confirmado');
        await svc.FluxoCaixa.update(fluxo.id, { status:novoStatus, valor_realizado:match.valor, lancamento_bancario_id:match.id });
        lancsUsados.add(match.id);
        if (isRealizado) realizados++; else confirmados++;

        detalhes.push({
          fluxo_id: fluxo.id,
          descricao: fluxo.descricao,
          cliente: nf?.cliente || '—',
          valor_previsto: valorPrevisto,
          valor_realizado: match.valor,
          diff_dias: Math.round(diff),
          status: novoStatus,
        });
      } catch (err) {
        console.error('Erro conciliação faturamento-fluxo:', err.message);
        semMatch++;
      }
    }

    return Response.json({
      success: true,
      realizados,
      confirmados,
      sem_match: semMatch,
      total_previstos: fluxosPrevistos.length,
      detalhes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}