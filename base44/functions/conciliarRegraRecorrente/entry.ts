import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Apenas administradores podem conciliar' }, { status: 403 });
    const { regra_id, lancamento_id, simular = false } = await req.json();
    if (typeof regra_id !== 'string' || typeof lancamento_id !== 'string' || regra_id.length > 100 || lancamento_id.length > 100) return Response.json({ error: 'Informe a regra e o lançamento' }, { status: 400 });
    const db = base44.entities;
    const [[regra], [lanc], vinculos] = await Promise.all([
      db.RegraRecorrente.filter({ id: regra_id }), db.LancamentoBancario.filter({ id: lancamento_id }), db.VinculoExtrato.filter({ lancamento_bancario_id: lancamento_id })
    ]);
    if (!regra || !lanc) return Response.json({ error: 'Regra ou débito não encontrado' }, { status: 404 });
    if (vinculos.length || ['conciliado', 'parcial', 'ignorar'].includes(lanc.status_conciliacao) || lanc.alerta_duplicidade || lanc.duplicidade_ref || lanc.item_compra_id) return Response.json({ error: 'Débito já vinculado, ignorado ou sinalizado como duplicado; revise a conciliação existente.' }, { status: 409 });
    if (!(lanc.valor < 0) || ['transferencia', 'interno', 'financeiro'].includes(lanc.categoria)) return Response.json({ error: 'Movimento não elegível para despesa recorrente' }, { status: 422 });
    const palavras = norm(regra.padrao_descricao).split(' ').filter(p => p.length > 2);
    const texto = norm(`${lanc.descricao || ''} ${lanc.detalhe || ''}`);
    const intervalo = { mensal: 1, trimestral: 3, anual: 12 }[regra.frequencia || 'mensal'];
    const [a, m] = lanc.data.slice(0, 7).split('-').map(Number);
    const [ia, im] = (regra.mes_inicio || lanc.data.slice(0, 7)).split('-').map(Number);
    const distancia = (a - ia) * 12 + m - im;
    const desvio = Math.abs(Math.abs(lanc.valor) - regra.valor_esperado) / regra.valor_esperado * 100;
    if (!regra.is_ativa || !palavras.length || !palavras.every(p => texto.includes(p)) || !intervalo || (intervalo > 1 && !regra.mes_inicio) || distancia < 0 || distancia % intervalo !== 0 || (regra.conta_bancaria && regra.conta_bancaria !== lanc.conta_bancaria) || !(regra.valor_esperado > 0) || desvio > (regra.tolerancia_percentual ?? 5)) return Response.json({ error: 'Débito fora do padrão, frequência, conta ou tolerância da regra' }, { status: 422 });
    if (!regra.origem_compra || !['estoque', 'despesas', 'impostos', 'folha', 'obras', 'pro_labore'].includes(regra.tipo_compra)) return Response.json({ error: 'Preencha a classificação da regra antes de conciliar' }, { status: 422 });
    // Um FK direto em outro módulo também bloqueia a criação de uma nova despesa.
    const outros = await Promise.all(['Tributo', 'FolhaPagamento', 'ObraReforma', 'ItemCompra', 'FaturaCartao', 'MovimentoFinanceiro'].map(t => db[t].filter({ lancamento_bancario_id: lanc.id }, '-created_date', 1)));
    if (outros.some(lista => lista.length)) return Response.json({ error: 'Débito já registrado em outro módulo; restaure seu vínculo em vez de criar outra despesa.' }, { status: 409 });
    const diretas = await db.DespesaOperacional.filter({ lancamento_bancario_id: lanc.id });
    let despesa = diretas.length === 1 ? diretas[0] : null;
    if (diretas.length > 1) return Response.json({ error: 'Há despesas duplicadas para este débito; revise antes de conciliar.' }, { status: 409 });
    if (!despesa) {
      const candidatas = [];
      for (let skip = 0; ; skip += 100) {
        const pagina = await db.DespesaOperacional.filter({ data: { $gte: `${lanc.data.slice(0, 7)}-01`, $lte: `${lanc.data.slice(0, 7)}-31` } }, 'id', 100, skip);
        candidatas.push(...pagina.filter(d => Math.abs(d.valor - Math.abs(lanc.valor)) < 0.01 && palavras.every(p => norm(`${d.descricao} ${d.fornecedor || ''}`).includes(p)) && (!regra.empresa || !d.empresa || d.empresa === regra.empresa)));
        if (pagina.length < 100) break;
      }
      if (candidatas.length > 1 || candidatas.some(d => d.lancamento_cartao_id || d.lancamento_bancario_id)) return Response.json({ error: 'Já existem despesas compatíveis; revise os vínculos para evitar duplicidade.' }, { status: 409 });
      despesa = candidatas[0];
    }
    if (despesa) {
      const existentes = await db.VinculoExtrato.filter({ entidade_tipo: 'DespesaOperacional', entidade_id: despesa.id });
      if (existentes.length || despesa.lancamento_cartao_id || Math.abs(despesa.valor - Math.abs(lanc.valor)) > 0.01) return Response.json({ error: 'Despesa já vinculada ou com valor diferente' }, { status: 409 });
    }
    if (simular) return Response.json({ success: true, acao: despesa ? 'vincular_despesa' : 'criar_despesa', valor: Math.abs(lanc.valor) });
    if (!despesa) {
      const categorias = ['aluguel','energia','agua','internet','telefone','manutencao','limpeza','marketing','contabilidade','juridico','seguro','transporte','alimentacao','material_escritorio','outro'];
      despesa = await db.DespesaOperacional.create({ data: lanc.data, data_vencimento: lanc.data, descricao: regra.nome, fornecedor: regra.fornecedor || lanc.descricao, categoria: categorias.includes(regra.categoria) ? regra.categoria : 'outro', origem_compra: regra.origem_compra, tipo_compra: regra.tipo_compra, ...(regra.empresa ? { empresa: regra.empresa } : {}), valor: Math.abs(lanc.valor), status: 'pendente', forma_pagamento: regra.forma_pagamento === 'cartao' ? 'transferencia' : regra.forma_pagamento || 'pix', recorrente: true, lancamento_bancario_id: lanc.id, observacoes: `Regra recorrente ${regra.id} · ${regra.nome}` });
    }
    const resultado = await base44.functions.invoke('vincularExtrato', { acao: 'criar', lancamento_bancario_id: lanc.id, entidade_tipo: 'DespesaOperacional', entidade_id: despesa.id, valor_alocado: Math.abs(lanc.valor), conciliado_por: 'regra_recorrente', observacao: `Regra ${regra.nome} (${regra.frequencia || 'mensal'})` });
    if (!resultado.data?.success) throw new Error(resultado.data?.error || 'Não foi possível criar o vínculo');
    await db.DespesaOperacional.update(despesa.id, { lancamento_bancario_id: lanc.id, recorrente: true });
    return Response.json({ success: true, despesa_id: despesa.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}