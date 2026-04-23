import { Shield, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';

const SEV = {
  alta:  { color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle },
  media: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  baixa: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Info },
  info:  { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Info },
};

function ScoreBar({ score }) {
  const color = score >= 85 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-500' : 'bg-rose-500';
  const label = score >= 85 ? 'Alta conformidade' : score >= 65 ? 'Atenção' : 'Baixa conformidade';
  return (
    <div className="bg-card border rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Score de Conformidade Fiscal</p>
        <span className="text-2xl font-bold tabular-nums">{score}<span className="text-sm text-muted-foreground">/100</span></span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export default function ConformidadeFiscal({ analise }) {
  const score = analise.score_conformidade ?? 0;
  const alertasGeral = analise.alertas_conformidade || [];
  const divergenciasFiscais = analise.divergencias_fiscais || [];
  const produtos = analise.produtos || [];

  const byProduto = produtos.map(p => ({
    descricao: p.descricao,
    codigo: p.codigo,
    ncm: p.ncm,
    cfop: p.cfop,
    cst_icms: p.cst_icms,
    score: p.conformidade_fiscal?.score ?? 100,
    alertas: p.conformidade_fiscal?.alertas || [],
  })).sort((a, b) => a.score - b.score);

  const criticos = byProduto.filter(p => p.score < 65);
  const atencao = byProduto.filter(p => p.score >= 65 && p.score < 85);
  const ok = byProduto.filter(p => p.score >= 85);

  return (
    <div className="space-y-4">
      {/* Cabeçalho regime + score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ScoreBar score={score} />
        <div className="bg-card border rounded-xl p-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Regime Tributário Emitente</p>
          <p className="font-bold text-sm capitalize">{(analise.emitente_regime || 'desconhecido').replace(/_/g, ' ')}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{analise.emitente_uf || '—'} → {analise.destinatario_uf || '—'} {analise.operacao_interestadual ? '(interestadual)' : '(interno)'}</p>
        </div>
        <div className="bg-card border rounded-xl p-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Natureza da Operação</p>
          <p className="font-bold text-sm">{analise.natureza_operacao || '—'}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Tributos aprox.: R$ {(analise.tributos_aproximados || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Alertas gerais da NF-e */}
      {alertasGeral.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-900 mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Alertas aritméticos e de regime ({alertasGeral.length})</p>
          <ul className="space-y-1 text-xs text-amber-800">
            {alertasGeral.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        </div>
      )}

      {/* Divergências fiscais detalhadas (NF-e vs Pedido + produtos) */}
      {divergenciasFiscais.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Divergências fiscais detalhadas ({divergenciasFiscais.length})</p>
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-2 py-1.5">Severidade</th>
                    <th className="text-left px-2 py-1.5">Tipo</th>
                    <th className="text-left px-2 py-1.5">Produto</th>
                    <th className="text-left px-2 py-1.5">Campo</th>
                    <th className="text-left px-2 py-1.5">Esperado</th>
                    <th className="text-left px-2 py-1.5">Encontrado</th>
                    <th className="text-left px-2 py-1.5">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {divergenciasFiscais.map((d, i) => {
                    const cfg = SEV[d.severidade] || SEV.media;
                    const Icon = cfg.icon;
                    return (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${cfg.color}`}>
                            <Icon className="w-3 h-3" /> {d.severidade}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{d.tipo}</td>
                        <td className="px-2 py-1.5 max-w-[180px] truncate">{d.produto}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{d.campo}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{d.esperado || '—'}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{d.encontrado || '—'}</td>
                        <td className="px-2 py-1.5 max-w-[280px]">{d.observacao}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Score por produto */}
      <div>
        <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Conformidade por produto ({produtos.length})</p>
        <div className="grid grid-cols-3 gap-2 mb-2 text-[10px]">
          <div className="bg-rose-50 border border-rose-200 rounded p-2"><XCircle className="w-3 h-3 inline text-rose-600" /> {criticos.length} críticos (&lt;65)</div>
          <div className="bg-amber-50 border border-amber-200 rounded p-2"><AlertTriangle className="w-3 h-3 inline text-amber-600" /> {atencao.length} atenção (65–84)</div>
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2"><CheckCircle2 className="w-3 h-3 inline text-emerald-600" /> {ok.length} OK (≥85)</div>
        </div>
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-2 py-1.5">Produto</th>
                <th className="text-left px-2 py-1.5">NCM</th>
                <th className="text-left px-2 py-1.5">CFOP</th>
                <th className="text-left px-2 py-1.5">CST</th>
                <th className="text-center px-2 py-1.5">Score</th>
                <th className="text-left px-2 py-1.5">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {byProduto.map((p, i) => (
                <tr key={i} className="border-b align-top">
                  <td className="px-2 py-1.5 max-w-[200px] truncate font-medium">{p.descricao}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{p.ncm || '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{p.cfop || '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{p.cst_icms || '—'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`font-bold ${p.score >= 85 ? 'text-emerald-600' : p.score >= 65 ? 'text-amber-600' : 'text-rose-600'}`}>{p.score}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    {p.alertas.length === 0 ? (
                      <span className="text-emerald-600">✓ conforme</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {p.alertas.map((a, j) => <li key={j} className="text-[10px] text-rose-700">• {a}</li>)}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}