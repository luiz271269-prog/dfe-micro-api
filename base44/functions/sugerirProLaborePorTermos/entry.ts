import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

// ─────────────────────────────────────────────────────────────────────────────
// Sugere classificação como PRÓ-LABORE em lançamentos do extrato e dos cartões,
// com base em termos-chave aprendidos (RegraCategorizacao categoria='pro_labore')
// + padrões fixos de retirada/sócio. NUNCA sobrescreve algo já classificado como
// despesa operacional/fornecedor/tributo — só atua sobre lançamentos "neutros".
//
// Modos:
//   - Entidade nova (automação): payload { event, data } → avalia 1 lançamento.
//   - Varredura manual: payload { dry_run?: boolean, escopo?: 'extrato'|'cartao'|'ambos' }.
//
// "Sugerir" = no extrato grava categoria 'pro_labore'; no cartão grava natureza 'pessoal'.
// Para não misturar, só aplica quando há match de termo E o lançamento está neutro.
// ─────────────────────────────────────────────────────────────────────────────

// Padrões fixos que SEMPRE indicam pró-labore / retirada do sócio
const PADROES_PRO_LABORE = [
  /pro[\s-]?labore/i, /prolabore/i, /pró[\s-]?labore/i,
  /retirada\s+s[óo]cio/i, /retirada\s+pessoal/i,
  /distrib(\.|uicao|uição)?\s+lucros?/i, /dividendos?/i,
];

// Categorias do EXTRATO consideradas "neutras" (podem virar pró-labore)
const EXTRATO_NEUTRAS = ['', 'saque', 'financeiro', 'interno', 'transferencia'];

function normalizar(texto) {
  if (!texto) return '';
  let s = texto.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\b\d{8,}\b/g, ' ');
  s = s.replace(/\b(pix[\s_-]?(cred|deb)?|ted|doc|pagto|pgto|recebimento|pagamento|transf|transferencia|cob\d+|cobranca)\b/g, ' ');
  s = s.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function termoChave(texto) {
  const s = normalizar(texto);
  return s.split(' ').filter(t => t.length >= 3).slice(0, 4).join(' ');
}

// Avalia se uma descrição casa com pró-labore (padrões fixos OU termos aprendidos)
function casaProLabore(descricao, termosAprendidos) {
  if (!descricao) return false;
  if (PADROES_PRO_LABORE.some(rx => rx.test(descricao))) return true;
  const tc = termoChave(descricao);
  if (!tc) return false;
  // match por termo aprendido (igualdade ou contido)
  return termosAprendidos.some(t => t && (tc === t || tc.includes(t) || t.includes(tc)));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const escopo = body.escopo || 'ambos';
    const svc = base44.asServiceRole.entities;

    // Carrega termos-chave aprendidos que apontam para pró-labore (de ambos os escopos)
    const regras = await svc.RegraCategorizacao.list('-ultima_atualizacao', 2000).catch(() => []);
    const termosAprendidos = regras
      .filter(r => r.categoria === 'pro_labore' || r.categoria === 'pessoal')
      .map(r => r.termo_chave)
      .filter(Boolean);

    // Modo automação: 1 lançamento vindo do evento de entidade
    const evento = body.event;
    const dataLanc = body.data;

    const sugestoesExtrato = [];
    const sugestoesCartao = [];

    // ─── EXTRATO ───
    if (escopo === 'ambos' || escopo === 'extrato') {
      let lancs;
      if (evento?.entity_name === 'LancamentoBancario' && dataLanc) {
        lancs = [{ ...dataLanc, id: evento.entity_id }];
      } else {
        lancs = await svc.LancamentoBancario.list('-data', 5000);
      }
      for (const l of lancs) {
        if (l.categoria === 'pro_labore') continue;
        if (!EXTRATO_NEUTRAS.includes(l.categoria || '')) continue; // não mexe em despesa operacional, fornecedor, tributo, etc.
        if (casaProLabore(l.descricao, termosAprendidos)) {
          sugestoesExtrato.push({ id: l.id, data: l.data, descricao: l.descricao, valor: l.valor, categoria_atual: l.categoria });
          if (!dryRun) await svc.LancamentoBancario.update(l.id, { categoria: 'pro_labore' });
        }
      }
    }

    // ─── CARTÕES ───
    if (escopo === 'ambos' || escopo === 'cartao') {
      let lancs;
      if (evento?.entity_name === 'LancamentoCartao' && dataLanc) {
        lancs = [{ ...dataLanc, id: evento.entity_id }];
      } else {
        lancs = await svc.LancamentoCartao.list('-data_lancamento', 5000);
      }
      for (const l of lancs) {
        if (l.natureza === 'pessoal') continue;
        if (l.natureza === 'empresa') continue; // já marcado como despesa da empresa — não mistura
        if (casaProLabore(l.estabelecimento, termosAprendidos)) {
          sugestoesCartao.push({ id: l.id, data: l.data_lancamento, descricao: l.estabelecimento, valor: l.valor, natureza_atual: l.natureza });
          if (!dryRun) await svc.LancamentoCartao.update(l.id, { natureza: 'pessoal' });
        }
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      escopo,
      termos_usados: termosAprendidos.length,
      extrato: { total: sugestoesExtrato.length, itens: sugestoesExtrato.slice(0, 100) },
      cartao: { total: sugestoesCartao.length, itens: sugestoesCartao.slice(0, 100) },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});