import { useState } from "react";

const ENTITIES = {
  // Receita
  NotaFiscal:        { x: 80,  y: 80,  color: "#22c55e", group: "receita",  label: "NotaFiscal" },
  TituloCobranca:    { x: 280, y: 80,  color: "#22c55e", group: "receita",  label: "TituloCobranca" },
  RelatorioFaturamento: { x: 80, y: 200, color: "#86efac", group: "receita", label: "RelatorioFaturamento" },
  ConciliacaoItem:   { x: 280, y: 200, color: "#4ade80", group: "receita",  label: "ConciliacaoItem" },

  // Centro
  LancamentoBancario:{ x: 520, y: 240, color: "#f59e0b", group: "centro",  label: "LancamentoBancario" },
  FluxoCaixa:        { x: 520, y: 100, color: "#fbbf24", group: "centro",  label: "FluxoCaixa" },

  // Pagamentos diretos
  Tributo:           { x: 760, y: 60,  color: "#ef4444", group: "pagamento", label: "Tributo" },
  FolhaPagamento:    { x: 760, y: 170, color: "#ef4444", group: "pagamento", label: "FolhaPagamento" },
  DespesaOperacional:{ x: 760, y: 280, color: "#ef4444", group: "pagamento", label: "DespesaOperacional" },
  ObraReforma:       { x: 760, y: 390, color: "#f97316", group: "pagamento", label: "ObraReforma" },

  // Cartão
  FaturaCartao:      { x: 520, y: 400, color: "#8b5cf6", group: "cartao",   label: "FaturaCartao" },
  LancamentoCartao:  { x: 760, y: 490, color: "#8b5cf6", group: "cartao",   label: "LancamentoCartao" },
  ContaCartao:       { x: 520, y: 490, color: "#a78bfa", group: "cartao",   label: "ContaCartao" },

  // Compras
  ItemCompra:        { x: 280, y: 400, color: "#3b82f6", group: "compra",   label: "ItemCompra" },
  NFeAnalise:        { x: 80,  y: 400, color: "#60a5fa", group: "compra",   label: "NFeAnalise" },
  Fornecedor:        { x: 80,  y: 490, color: "#93c5fd", group: "compra",   label: "Fornecedor" },

  // RH
  Funcionario:       { x: 980, y: 170, color: "#ec4899", group: "rh",       label: "Funcionario" },

  // Infra
  ImportBatch:       { x: 980, y: 60,  color: "#6b7280", group: "infra",    label: "ImportBatch" },
  RegraRecorrente:   { x: 980, y: 280, color: "#6b7280", group: "infra",    label: "RegraRecorrente" },
  NotificacaoConformidade: { x: 980, y: 400, color: "#6b7280", group: "infra", label: "NotificacaoConformidade" },
};

const LINKS = [
  { from: "NotaFiscal",         to: "TituloCobranca",      type: "ok",      label: "nota_fiscal_id" },
  { from: "LancamentoCartao",   to: "FaturaCartao",        type: "ok",      label: "fatura_id" },
  { from: "FaturaCartao",       to: "ContaCartao",         type: "ok",      label: "conta_cartao_id" },
  { from: "ItemCompra",         to: "LancamentoBancario",  type: "ok",      label: "lancamento_bancario_id" },
  { from: "ItemCompra",         to: "LancamentoCartao",    type: "ok",      label: "lancamento_cartao_id" },
  { from: "LancamentoBancario", to: "ItemCompra",          type: "ok",      label: "item_compra_id" },
  { from: "LancamentoCartao",   to: "ItemCompra",          type: "ok",      label: "item_compra_id" },
  { from: "ObraReforma",        to: "LancamentoCartao",    type: "ok",      label: "lancamento_cartao_id" },
  { from: "ConciliacaoItem",    to: "LancamentoBancario",  type: "ok",      label: "lancamento_bancario_id" },
  { from: "ConciliacaoItem",    to: "NotaFiscal",          type: "ok",      label: "nota_fiscal_ids[]" },
  { from: "NFeAnalise",         to: "ItemCompra",          type: "ok",      label: "item_compra_ids[]" },
  { from: "NotificacaoConformidade", to: "NFeAnalise",     type: "ok",      label: "nfe_analise_id" },
  { from: "ItemCompra",         to: "Fornecedor",          type: "ok",      label: "fornecedor_id (opt)" },
  { from: "FluxoCaixa",         to: "NotaFiscal",          type: "ok",      label: "origem_id polymorphic" },

  { from: "FolhaPagamento",     to: "LancamentoBancario",  type: "missing", label: "❌ sem lancamento_bancario_id" },
  { from: "Tributo",            to: "LancamentoBancario",  type: "missing", label: "❌ sem lancamento_bancario_id" },
  { from: "FaturaCartao",       to: "LancamentoBancario",  type: "missing", label: "❌ sem lancamento_bancario_id" },
  { from: "DespesaOperacional", to: "LancamentoBancario",  type: "missing", label: "❌ sem lancamento_bancario_id" },
  { from: "ObraReforma",        to: "LancamentoBancario",  type: "missing", label: "❌ sem lancamento_bancario_id" },

  { from: "ConciliacaoItem",    to: "TituloCobranca",      type: "missing", label: "⚠️ sem titulo_cobranca_id" },
  { from: "TituloCobranca",     to: "LancamentoBancario",  type: "missing", label: "⚠️ sem lancamento_bancario_id" },
  { from: "FluxoCaixa",         to: "LancamentoBancario",  type: "missing", label: "⚠️ sem lancamento_bancario_id" },
  { from: "NFeAnalise",         to: "LancamentoBancario",  type: "missing", label: "⚠️ 4-way match incompleto" },
  { from: "DespesaOperacional", to: "LancamentoCartao",    type: "missing", label: "⚠️ sem lancamento_cartao_id" },

  { from: "TituloCobranca",     to: "NotaFiscal",          type: "broken",  label: "🔴 169 registros com null" },
  { from: "FolhaPagamento",     to: "Funcionario",         type: "broken",  label: "🔴 string, não FK real" },

  { from: "RegraRecorrente",    to: "DespesaOperacional",  type: "missing", label: "⚠️ sem rastreamento de saída" },
  { from: "ImportBatch",        to: "LancamentoBancario",  type: "missing", label: "⚠️ sem FK para registros criados" },
  { from: "RelatorioFaturamento", to: "NotaFiscal",        type: "missing", label: "⚠️ sem reconciliação automática" },
];

const GAPS = [
  { id: 1, priority: "P1", icon: "🔴", title: "FolhaPagamento → LancamentoBancario",
    desc: "Salário é registrado mas não existe campo para vincular ao débito no extrato. Impossível confirmar se o pagamento saiu da conta.",
    fix: "Adicionar campo lancamento_bancario_id em FolhaPagamento",
    impact: "Fluxo de caixa real x previsto sempre diverge" },
  { id: 2, priority: "P1", icon: "🔴", title: "Tributo → LancamentoBancario",
    desc: "Tributos (DAS, INSS, FGTS…) têm data_pagamento e valor_pago mas nenhum FK para o lançamento bancário que confirmou o pagamento.",
    fix: "Adicionar lancamento_bancario_id em Tributo",
    impact: "DAS marcado como pago mesmo sem débito confirmado no extrato" },
  { id: 3, priority: "P1", icon: "🔴", title: "FaturaCartao → LancamentoBancario",
    desc: "O pagamento da fatura do cartão aparece como débito no extrato, mas FaturaCartao não tem FK para esse lançamento. Cadeia quebrada: LancamentoCartao→FaturaCartao→??? ✗ LancamentoBancario",
    fix: "Adicionar lancamento_bancario_id em FaturaCartao",
    impact: "Valor da fatura conta duplamente (como cartão E como débito bancário)" },
  { id: 4, priority: "P1", icon: "🔴", title: "TituloCobranca.nota_fiscal_id: 169 registros nulos",
    desc: "Todos os 169 TituloCobranca importados têm nota_fiscal_id = null. O elo entre cobrança Sicredi e NF emitida está totalmente quebrado.",
    fix: "Cruzar nosso_numero/seu_numero com campos da NotaFiscal e popular nota_fiscal_id",
    impact: "Inadimplência não consegue ser atribuída a NF específica" },
  { id: 5, priority: "P1", icon: "🔴", title: "DespesaOperacional: sem FK de pagamento",
    desc: "DespesaOperacional tem forma_pagamento (pix/boleto/cartao) mas nenhum campo lancamento_bancario_id nem lancamento_cartao_id. Despesa fica suspensa no ar após ser registrada.",
    fix: "Adicionar lancamento_bancario_id e lancamento_cartao_id em DespesaOperacional",
    impact: "Conciliação automática não consegue baixar despesas pagas" },
  { id: 6, priority: "P2", icon: "🟡", title: "ObraReforma → LancamentoBancario (ausente)",
    desc: "ObraReforma tem lancamento_cartao_id mas NÃO tem lancamento_bancario_id. Obras pagas via PIX ou boleto ficam sem confirmação de pagamento.",
    fix: "Adicionar lancamento_bancario_id em ObraReforma",
    impact: "Obras pagas via banco não conseguem baixa automática" },
  { id: 7, priority: "P2", icon: "🟡", title: "ConciliacaoItem → TituloCobranca (ausente)",
    desc: "ConciliacaoItem liga LancamentoBancario↔NotaFiscal mas pula o TituloCobranca. Quando o pagamento vem de boleto Sicredi, o título não é baixado automaticamente pelo item de conciliação.",
    fix: "Adicionar titulo_cobranca_id em ConciliacaoItem",
    impact: "Títulos Sicredi exigem baixa manual mesmo após conciliação" },
  { id: 8, priority: "P2", icon: "🟡", title: "TituloCobranca → LancamentoBancario (direto ausente)",
    desc: "Não existe FK direto entre TituloCobranca e LancamentoBancario. A trilha Sicredi↔Extrato depende inteiramente do ConciliacaoItem como intermediário.",
    fix: "Adicionar lancamento_bancario_id em TituloCobranca",
    impact: "Relatório de cobrança não sabe qual extrato liquidou o título" },
  { id: 9, priority: "P2", icon: "🟡", title: "FluxoCaixa → LancamentoBancario (realização)",
    desc: "FluxoCaixa tem status 'realizado' mas sem FK para o lançamento bancário que realizou. O fluxo previsto nunca fecha o ciclo com o extrato real.",
    fix: "Adicionar lancamento_bancario_id em FluxoCaixa",
    impact: "Variância previsto x realizado calculada manualmente" },
  { id: 10, priority: "P2", icon: "🟡", title: "NFeAnalise: 4-way match incompleto",
    desc: "NFeAnalise→ItemCompra existe, mas não há link para LancamentoBancario/LancamentoCartao. O XML fiscal comprova a compra mas não confirma se foi paga.",
    fix: "Adicionar lancamento_ids[] em NFeAnalise",
    impact: "Compliance fiscal não verifica se a NF de entrada foi paga" },
  { id: 11, priority: "P3", icon: "⚪", title: "FolhaPagamento.funcionario_id: string fraca",
    desc: "funcionario_id é string livre, não FK para Funcionario.id. Causou duplicatas de 5 funcionários em fevereiro/2026.",
    fix: "Normalizar para usar o _id real do Funcionario",
    impact: "Relatórios de RH produzem duplicatas" },
  { id: 12, priority: "P3", icon: "⚪", title: "NotaFiscal sem campo empresa",
    desc: "NotaFiscal não tem campo empresa (NeuralTec/Liesch). Impossível segregar faturamento por CNPJ nos relatórios consolidados.",
    fix: "Adicionar campo empresa com enum ['NeuralTec','Liesch']",
    impact: "DRE por empresa não é possível automaticamente" },
  { id: 13, priority: "P3", icon: "⚪", title: "RegraRecorrente sem rastreamento de saída",
    desc: "RegraRecorrente define padrões de matching mas não registra quais LancamentoBancario ou DespesaOperacional foram identificados por ela.",
    fix: "Adicionar regra_recorrente_id em DespesaOperacional/LancamentoBancario",
    impact: "Auditoria das regras é impossível" },
  { id: 14, priority: "P3", icon: "⚪", title: "ImportBatch sem FK para registros criados",
    desc: "ImportBatch registra metadados do lote mas não tem FK para os registros criados. Impossível rastrear 'qual import gerou qual lançamento'.",
    fix: "Adicionar import_batch_id em LancamentoBancario, TituloCobranca, ItemCompra, etc.",
    impact: "Desfazer um import exige busca manual" },
  { id: 15, priority: "P3", icon: "⚪", title: "RelatorioFaturamento sem reconciliação com NotaFiscal",
    desc: "RelatorioFaturamento (fonte externa: Fabris/Ellitte) não tem job automático que some as NotaFiscal do mesmo mês e alerta sobre divergência.",
    fix: "Job mensal: Σ NotaFiscal.valor_total WHERE mes = referencia → comparar com RelatorioFaturamento.total",
    impact: "Divergência entre fiscal e gerencial passa despercebida" },
];

const COLS = { receita: "#22c55e", centro: "#f59e0b", pagamento: "#ef4444", cartao: "#8b5cf6", compra: "#3b82f6", rh: "#ec4899", infra: "#6b7280" };
const GCOLS = { receita: "rgba(34,197,94,0.08)", centro: "rgba(245,158,11,0.08)", pagamento: "rgba(239,68,68,0.08)", cartao: "rgba(139,92,246,0.08)", compra: "rgba(59,130,246,0.08)", rh: "rgba(236,72,153,0.08)", infra: "rgba(107,114,128,0.08)" };

export default function DiagnosticoConciliacao() {
  const [activeGap, setActiveGap] = useState(null);
  const [filterP, setFilterP] = useState("all");
  const [hoveredEntity, setHoveredEntity] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState("diagram");

  const filtered = GAPS.filter(g => filterP === "all" || g.priority === filterP);

  const W = 1100, H = 580;
  const NODE_W = 155, NODE_H = 34;

  const getPos = (name) => {
    const e = ENTITIES[name];
    return { cx: e.x + NODE_W / 2, cy: e.y + NODE_H / 2 };
  };

  const renderLink = (link, i) => {
    const { cx: x1, cy: y1 } = getPos(link.from);
    const { cx: x2, cy: y2 } = getPos(link.to);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len, uy = dy / len;
    const sx = x1 + ux * NODE_W / 2;
    const sy = y1 + uy * NODE_H / 2;
    const ex = x2 - ux * NODE_W / 2;
    const ey = y2 - uy * NODE_H / 2;
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;

    const colors = { ok: "#4ade80", missing: "#ef4444", broken: "#f97316", weak: "#fbbf24" };
    const dashes = { ok: "none", missing: "6,4", broken: "2,3", weak: "8,3" };
    const opacity = { ok: 0.35, missing: 0.85, broken: 0.9, weak: 0.5 };
    const width = { ok: 1.5, missing: 2, broken: 2, weak: 1.5 };

    if (!showAll && link.type === "ok") return null;

    return (
      <g key={i}>
        <defs>
          <marker id={`arrow-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={colors[link.type]} opacity={opacity[link.type]} />
          </marker>
        </defs>
        <line
          x1={sx} y1={sy} x2={ex} y2={ey}
          stroke={colors[link.type]}
          strokeWidth={width[link.type]}
          strokeDasharray={dashes[link.type]}
          opacity={opacity[link.type]}
          markerEnd={`url(#arrow-${i})`}
        />
        {link.type !== "ok" && (
          <text x={mx} y={my - 5} fill={colors[link.type]} fontSize="9" textAnchor="middle" opacity={0.8} fontFamily="monospace">
            {link.type === "missing" ? "FALTA" : "QUEBRADO"}
          </text>
        )}
      </g>
    );
  };

  const renderNode = (name, entity) => {
    const relatedLinks = LINKS.filter(l => l.from === name || l.to === name);
    const hasMissing = relatedLinks.some(l => l.type === "missing" || l.type === "broken");
    const isHighlighted = activeGap && (
      GAPS[activeGap - 1] && (
        GAPS[activeGap - 1].title.includes(name)
      )
    );

    return (
      <g key={name}
        onMouseEnter={() => setHoveredEntity(name)}
        onMouseLeave={() => setHoveredEntity(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x={entity.x} y={entity.y}
          width={NODE_W} height={NODE_H}
          rx={6}
          fill={GCOLS[entity.group]}
          stroke={isHighlighted ? "#fff" : entity.color}
          strokeWidth={isHighlighted ? 2 : hasMissing ? 1.5 : 1}
          opacity={isHighlighted ? 1 : 0.9}
        />
        {hasMissing && (
          <circle cx={entity.x + NODE_W - 8} cy={entity.y + 8} r={5} fill="#ef4444" />
        )}
        <text
          x={entity.x + NODE_W / 2}
          y={entity.y + NODE_H / 2 + 1}
          fill={entity.color}
          fontSize="10.5"
          fontWeight="600"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="'JetBrains Mono', 'Courier New', monospace"
        >
          {entity.label}
        </text>
      </g>
    );
  };

  const p1 = GAPS.filter(g => g.priority === "P1").length;
  const p2 = GAPS.filter(g => g.priority === "P2").length;
  const p3 = GAPS.filter(g => g.priority === "P3").length;
  const totalOk = LINKS.filter(l => l.type === "ok").length;
  const totalBroken = LINKS.filter(l => l.type !== "ok").length;

  return (
    <div style={{
      background: "#0a0a0f",
      minHeight: "100%",
      color: "#e2e8f0",
      fontFamily: "'Inter', sans-serif",
      padding: "24px"
    }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />
          <span style={{ fontSize: 11, letterSpacing: 3, color: "#6b7280", textTransform: "uppercase" }}>NeuralFin · Diagnóstico de Conciliação</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -1, color: "#f1f5f9" }}>
          Análise Forense dos Fluxos
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
          {totalOk} conexões funcionais · {totalBroken} lacunas identificadas · {GAPS.length} gaps para corrigir
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "P1 Crítico", value: p1, color: "#ef4444", bg: "rgba(239,68,68,0.1)", desc: "Bloqueiam auditoria" },
          { label: "P2 Importante", value: p2, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", desc: "Conciliação manual" },
          { label: "P3 Melhoria", value: p3, color: "#6b7280", bg: "rgba(107,114,128,0.1)", desc: "Rastreabilidade" },
          { label: "Conexões OK", value: totalOk, color: "#22c55e", bg: "rgba(34,197,94,0.1)", desc: "Funcionais" },
          { label: "Lacunas", value: totalBroken, color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", desc: "Total de gaps" },
        ].map(k => (
          <div key={k.label} style={{
            background: k.bg,
            border: `1px solid ${k.color}22`,
            borderRadius: 10,
            padding: "12px 18px",
            flex: 1,
            minWidth: 160
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: k.color, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{k.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        {["diagram", "list"].map(v => (
          <button key={v} onClick={() => setViewMode(v)} style={{
            padding: "6px 16px", borderRadius: 6, border: "1px solid",
            borderColor: viewMode === v ? "#f59e0b" : "#1e293b",
            background: viewMode === v ? "rgba(245,158,11,0.1)" : "transparent",
            color: viewMode === v ? "#f59e0b" : "#64748b",
            fontSize: 12, fontWeight: 600, cursor: "pointer"
          }}>
            {v === "diagram" ? "🗺 Diagrama" : "📋 Lista de Gaps"}
          </button>
        ))}
        {viewMode === "diagram" && (
          <button onClick={() => setShowAll(!showAll)} style={{
            padding: "6px 16px", borderRadius: 6, border: "1px solid",
            borderColor: showAll ? "#22c55e" : "#1e293b",
            background: showAll ? "rgba(34,197,94,0.08)" : "transparent",
            color: showAll ? "#22c55e" : "#64748b",
            fontSize: 12, cursor: "pointer"
          }}>
            {showAll ? "✅ Mostrando tudo" : "Mostrar conexões OK"}
          </button>
        )}
      </div>

      {viewMode === "diagram" && (
        <div style={{
          background: "#0d1117",
          border: "1px solid #1e293b",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          overflowX: "auto"
        }}>
          <div style={{ display: "flex", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { color: "#4ade80", dash: "none", label: "Conexão OK" },
              { color: "#ef4444", dash: "6,4", label: "FK ausente (missing)" },
              { color: "#f97316", dash: "2,3", label: "FK quebrado / nulo" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="28" height="10">
                  <line x1="0" y1="5" x2="28" y2="5" stroke={l.color} strokeWidth="2" strokeDasharray={l.dash} />
                </svg>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{l.label}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {Object.entries({ receita: "Receita", centro: "Banco/Caixa", pagamento: "Pagamentos", cartao: "Cartão", compra: "Compras", rh: "RH", infra: "Infra" }).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: COLS[k] }} />
                  <span style={{ fontSize: 10, color: "#64748b" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", minWidth: W }}>
            {[
              { x: 55, y: 55, w: 360, h: 180, group: "receita", label: "RECEITA" },
              { x: 490, y: 70, w: 155, h: 195, group: "centro", label: "BANCO/CAIXA" },
              { x: 730, y: 35, w: 190, h: 400, group: "pagamento", label: "PAGAMENTOS" },
              { x: 490, y: 370, w: 295, h: 150, group: "cartao", label: "CARTÃO" },
              { x: 55, y: 370, w: 360, h: 155, group: "compra", label: "COMPRAS" },
              { x: 950, y: 35, w: 130, h: 420, group: "infra", label: "INFRA" },
            ].map(g => (
              <g key={g.group}>
                <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={10} fill={GCOLS[g.group]} stroke={COLS[g.group]} strokeWidth={0.5} strokeOpacity={0.3} />
                <text x={g.x + 8} y={g.y + 14} fill={COLS[g.group]} fontSize="9" fontFamily="monospace" opacity={0.6} letterSpacing="2">{g.label}</text>
              </g>
            ))}

            {LINKS.map((link, i) => renderLink(link, i))}
            {Object.entries(ENTITIES).map(([name, entity]) => renderNode(name, entity))}

            <circle cx={ENTITIES.LancamentoBancario.x + NODE_W / 2} cy={ENTITIES.LancamentoBancario.y + NODE_H / 2}
              r={44} fill="rgba(245,158,11,0.05)" stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="4,3" />
            <text x={ENTITIES.LancamentoBancario.x + NODE_W / 2} y={ENTITIES.LancamentoBancario.y + NODE_H + 14}
              fill="#f59e0b" fontSize="9" textAnchor="middle" opacity={0.6}>CENTRO DO SISTEMA</text>
          </svg>
          {hoveredEntity && (
            <div style={{ marginTop: 12, fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
              {hoveredEntity} · {LINKS.filter(l => l.from === hoveredEntity || l.to === hoveredEntity).length} conexões
            </div>
          )}
        </div>
      )}

      {viewMode === "list" && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["all", "P1", "P2", "P3"].map(p => (
              <button key={p} onClick={() => setFilterP(p)} style={{
                padding: "5px 14px", borderRadius: 6, border: "1px solid",
                borderColor: filterP === p ? "#f59e0b" : "#1e293b",
                background: filterP === p ? "rgba(245,158,11,0.1)" : "transparent",
                color: filterP === p ? "#f59e0b" : "#64748b",
                fontSize: 12, fontWeight: 600, cursor: "pointer"
              }}>
                {p === "all" ? "Todos" : p}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(gap => (
              <div key={gap.id}
                onClick={() => setActiveGap(activeGap === gap.id ? null : gap.id)}
                style={{
                  background: activeGap === gap.id ? "#111827" : "#0d1117",
                  border: `1px solid ${activeGap === gap.id ? (gap.priority === "P1" ? "#ef4444" : gap.priority === "P2" ? "#f59e0b" : "#374151") : "#1e293b"}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: gap.priority === "P1" ? "rgba(239,68,68,0.15)" : gap.priority === "P2" ? "rgba(245,158,11,0.15)" : "rgba(107,114,128,0.15)",
                    color: gap.priority === "P1" ? "#ef4444" : gap.priority === "P2" ? "#f59e0b" : "#6b7280",
                    border: `1px solid ${gap.priority === "P1" ? "#ef444430" : gap.priority === "P2" ? "#f59e0b30" : "#6b728030"}`
                  }}>{gap.priority}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", fontFamily: "monospace" }}>{gap.title}</span>
                  <span style={{ marginLeft: "auto", color: "#475569", fontSize: 12 }}>{activeGap === gap.id ? "▲" : "▼"}</span>
                </div>
                {activeGap === gap.id && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Problema</div>
                      <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{gap.desc}</div>
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Correção</div>
                        <div style={{ fontSize: 12, color: "#86efac", fontFamily: "monospace", background: "rgba(34,197,94,0.06)", padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.12)" }}>{gap.fix}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Impacto</div>
                        <div style={{ fontSize: 12, color: "#fca5a5", background: "rgba(239,68,68,0.06)", padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.12)" }}>{gap.impact}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "#0d1117", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Resumo — campos FK ausentes por entidade</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e293b" }}>
                {["Entidade", "FK Ausente", "Destino", "Prioridade", "Efeito"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 12px", color: "#475569", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { ent: "FolhaPagamento", fk: "lancamento_bancario_id", dest: "LancamentoBancario", p: "P1", ef: "Pagamento de salário sem confirmação de extrato" },
                { ent: "Tributo", fk: "lancamento_bancario_id", dest: "LancamentoBancario", p: "P1", ef: "DAS/FGTS sem prova de débito bancário" },
                { ent: "FaturaCartao", fk: "lancamento_bancario_id", dest: "LancamentoBancario", p: "P1", ef: "Fatura paga não fecha ciclo com extrato" },
                { ent: "DespesaOperacional", fk: "lancamento_bancario_id + lancamento_cartao_id", dest: "LancamentoBancario / LancamentoCartao", p: "P1", ef: "Despesa registrada sem confirmação de pagamento" },
                { ent: "TituloCobranca", fk: "nota_fiscal_id (169 nulls)", dest: "NotaFiscal", p: "P1", ef: "Cobrança Sicredi não rastreia NF de origem" },
                { ent: "ObraReforma", fk: "lancamento_bancario_id", dest: "LancamentoBancario", p: "P2", ef: "Obra paga via PIX sem confirmação" },
                { ent: "ConciliacaoItem", fk: "titulo_cobranca_id", dest: "TituloCobranca", p: "P2", ef: "Conciliação pula título, não dá baixa automática" },
                { ent: "TituloCobranca", fk: "lancamento_bancario_id", dest: "LancamentoBancario", p: "P2", ef: "Título não sabe qual extrato o liquidou" },
                { ent: "FluxoCaixa", fk: "lancamento_bancario_id", dest: "LancamentoBancario", p: "P2", ef: "Previsto nunca fecha com realizado" },
                { ent: "NotaFiscal", fk: "empresa", dest: "—", p: "P3", ef: "DRE por CNPJ impossível automaticamente" },
                { ent: "ImportBatch", fk: "FK nos registros criados", dest: "múltiplas entidades", p: "P3", ef: "Import não é rastreável nem reversível" },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #0f172a", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <td style={{ padding: "7px 12px", color: "#60a5fa", fontFamily: "monospace", fontSize: 11 }}>{row.ent}</td>
                  <td style={{ padding: "7px 12px", color: "#fca5a5", fontFamily: "monospace", fontSize: 11 }}>{row.fk}</td>
                  <td style={{ padding: "7px 12px", color: "#4ade80", fontFamily: "monospace", fontSize: 11 }}>{row.dest}</td>
                  <td style={{ padding: "7px 12px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                      background: row.p === "P1" ? "rgba(239,68,68,0.15)" : row.p === "P2" ? "rgba(245,158,11,0.15)" : "rgba(107,114,128,0.15)",
                      color: row.p === "P1" ? "#ef4444" : row.p === "P2" ? "#f59e0b" : "#6b7280",
                    }}>{row.p}</span>
                  </td>
                  <td style={{ padding: "7px 12px", color: "#64748b", fontSize: 11 }}>{row.ef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}