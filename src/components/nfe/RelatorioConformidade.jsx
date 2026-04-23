import { useMemo } from 'react';
import { Printer, FileDown, Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '../../lib/formatters';

export default function RelatorioConformidade({ analises }) {
  const stats = useMemo(() => {
    const total = analises.length;
    const scoreMedio = total > 0 ? Math.round(analises.reduce((s, a) => s + (a.score_conformidade || 0), 0) / total) : 0;

    const porRegime = {};
    const porEmitente = {};
    const tributosTotais = { icms: 0, icms_st: 0, ipi: 0, pis: 0, cofins: 0, total: 0, valor_produtos: 0 };
    const todasDivergenciasFiscais = [];
    const ncmUnicos = new Set();
    const ncmInvalidos = new Set();
    const cfopsInterestaduais = new Set();
    const cfopsInternas = new Set();

    analises.forEach(a => {
      porRegime[a.emitente_regime || 'desconhecido'] = (porRegime[a.emitente_regime || 'desconhecido'] || 0) + 1;
      const k = a.emitente_nome || '—';
      if (!porEmitente[k]) porEmitente[k] = { count: 0, valor: 0, score: 0, scoreCount: 0, divergencias: 0 };
      porEmitente[k].count++;
      porEmitente[k].valor += a.valor_total || 0;
      if (a.score_conformidade !== undefined) { porEmitente[k].score += a.score_conformidade; porEmitente[k].scoreCount++; }
      porEmitente[k].divergencias += (a.divergencias_fiscais || []).length;

      tributosTotais.icms += a.icms_total || 0;
      tributosTotais.icms_st += a.icms_st_total || 0;
      tributosTotais.ipi += a.ipi_total || 0;
      tributosTotais.pis += a.pis_total || 0;
      tributosTotais.cofins += a.cofins_total || 0;
      tributosTotais.total += a.valor_total || 0;
      tributosTotais.valor_produtos += a.valor_produtos || 0;

      (a.divergencias_fiscais || []).forEach(d => todasDivergenciasFiscais.push({ ...d, nf: a.numero_nota, emit: a.emitente_nome }));

      (a.produtos || []).forEach(p => {
        if (p.ncm) ncmUnicos.add(p.ncm);
        if (!p.ncm || p.ncm.length !== 8 || p.ncm === '00000000') ncmInvalidos.add(p.ncm || '(vazio)');
        if (p.cfop) {
          if (['2', '6'].includes(p.cfop[0])) cfopsInterestaduais.add(p.cfop);
          else cfopsInternas.add(p.cfop);
        }
      });
    });

    const porSeveridade = { alta: 0, media: 0, baixa: 0, info: 0 };
    todasDivergenciasFiscais.forEach(d => porSeveridade[d.severidade] = (porSeveridade[d.severidade] || 0) + 1);

    const emitentesRanking = Object.entries(porEmitente)
      .map(([nome, v]) => ({ nome, ...v, scoreMedio: v.scoreCount > 0 ? Math.round(v.score / v.scoreCount) : 0 }))
      .sort((a, b) => b.valor - a.valor);

    return {
      total, scoreMedio, porRegime, tributosTotais, todasDivergenciasFiscais, porSeveridade,
      emitentesRanking, ncmUnicos: ncmUnicos.size, ncmInvalidos: [...ncmInvalidos],
      cfopsInterestaduais: [...cfopsInterestaduais], cfopsInternas: [...cfopsInternas],
    };
  }, [analises]);

  function exportarCSV() {
    const rows = [
      ['NF', 'Emitente', 'CNPJ', 'Data', 'UF Origem', 'UF Destino', 'Regime', 'Valor Total', 'ICMS', 'ICMS-ST', 'IPI', 'PIS', 'COFINS', 'Score', 'Divergências', 'Alertas'],
      ...analises.map(a => [
        a.numero_nota || '', a.emitente_nome || '', a.emitente_cnpj || '',
        a.data_emissao || '', a.emitente_uf || '', a.destinatario_uf || '', a.emitente_regime || '',
        (a.valor_total || 0).toFixed(2), (a.icms_total || 0).toFixed(2), (a.icms_st_total || 0).toFixed(2),
        (a.ipi_total || 0).toFixed(2), (a.pis_total || 0).toFixed(2), (a.cofins_total || 0).toFixed(2),
        a.score_conformidade || 0, (a.divergencias_fiscais || []).length, (a.alertas_conformidade || []).join(' | '),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conformidade_nfe_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cargaTributaria = stats.tributosTotais.valor_produtos > 0
    ? ((stats.tributosTotais.icms + stats.tributosTotais.icms_st + stats.tributosTotais.ipi + stats.tributosTotais.pis + stats.tributosTotais.cofins) / stats.tributosTotais.valor_produtos * 100)
    : 0;

  return (
    <div className="space-y-4 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">Relatório consolidado de {stats.total} NF-e(s)</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportarCSV} className="gap-2"><FileDown className="w-3.5 h-3.5" /> Exportar CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2"><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
        </div>
      </div>

      {/* Sumário executivo */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-xs font-bold uppercase text-indigo-900 mb-2 flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Sumário Executivo</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-[10px] text-indigo-700 uppercase">Score médio</p>
            <p className={`text-2xl font-bold ${stats.scoreMedio >= 85 ? 'text-emerald-700' : stats.scoreMedio >= 65 ? 'text-amber-700' : 'text-rose-700'}`}>{stats.scoreMedio}/100</p>
          </div>
          <div>
            <p className="text-[10px] text-indigo-700 uppercase">Valor total NF-e</p>
            <p className="text-lg font-bold">{formatCurrency(stats.tributosTotais.total)}</p>
          </div>
          <div>
            <p className="text-[10px] text-indigo-700 uppercase">Carga tributária média</p>
            <p className="text-lg font-bold">{cargaTributaria.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-[10px] text-indigo-700 uppercase">Divergências fiscais</p>
            <p className="text-lg font-bold text-rose-700">{stats.todasDivergenciasFiscais.length}</p>
          </div>
        </div>
      </div>

      {/* Tributos agregados */}
      <div>
        <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Tributos consolidados</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <p className="text-[10px] text-blue-700">ICMS</p>
            <p className="font-bold">{formatCurrency(stats.tributosTotais.icms)}</p>
            <p className="text-[10px] text-muted-foreground">{stats.tributosTotais.valor_produtos > 0 ? (stats.tributosTotais.icms / stats.tributosTotais.valor_produtos * 100).toFixed(2) : 0}% s/ produtos</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <p className="text-[10px] text-blue-700">ICMS-ST</p>
            <p className="font-bold">{formatCurrency(stats.tributosTotais.icms_st)}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded p-2">
            <p className="text-[10px] text-purple-700">IPI</p>
            <p className="font-bold">{formatCurrency(stats.tributosTotais.ipi)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
            <p className="text-[10px] text-emerald-700">PIS</p>
            <p className="font-bold">{formatCurrency(stats.tributosTotais.pis)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
            <p className="text-[10px] text-emerald-700">COFINS</p>
            <p className="font-bold">{formatCurrency(stats.tributosTotais.cofins)}</p>
          </div>
        </div>
      </div>

      {/* Distribuição por regime e severidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card border rounded-xl p-3">
          <p className="text-xs font-bold uppercase text-muted-foreground mb-2">NF-e por regime tributário do emitente</p>
          <div className="space-y-1.5">
            {Object.entries(stats.porRegime).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${(v / stats.total) * 100}%` }} />
                  </div>
                  <span className="font-bold tabular-nums w-8 text-right">{v}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border rounded-xl p-3">
          <p className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Divergências por severidade</p>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-rose-50 rounded p-2 text-center">
              <p className="text-[10px] text-rose-700 uppercase">Alta</p>
              <p className="text-lg font-bold text-rose-700">{stats.porSeveridade.alta}</p>
            </div>
            <div className="bg-amber-50 rounded p-2 text-center">
              <p className="text-[10px] text-amber-700 uppercase">Média</p>
              <p className="text-lg font-bold text-amber-700">{stats.porSeveridade.media}</p>
            </div>
            <div className="bg-blue-50 rounded p-2 text-center">
              <p className="text-[10px] text-blue-700 uppercase">Baixa</p>
              <p className="text-lg font-bold text-blue-700">{stats.porSeveridade.baixa}</p>
            </div>
            <div className="bg-slate-50 rounded p-2 text-center">
              <p className="text-[10px] text-slate-700 uppercase">Info</p>
              <p className="text-lg font-bold text-slate-700">{stats.porSeveridade.info}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ranking de emitentes */}
      <div>
        <p className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Ranking de fornecedores (emitentes)</p>
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-2 py-1.5">Emitente</th>
                <th className="text-right px-2 py-1.5">NFs</th>
                <th className="text-right px-2 py-1.5">Valor total</th>
                <th className="text-center px-2 py-1.5">Score médio</th>
                <th className="text-center px-2 py-1.5">Divergências</th>
              </tr>
            </thead>
            <tbody>
              {stats.emitentesRanking.slice(0, 15).map((e, i) => (
                <tr key={i} className="border-b">
                  <td className="px-2 py-1.5 max-w-[260px] truncate font-medium">{e.nome}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{e.count}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{formatCurrency(e.valor)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`font-bold ${e.scoreMedio >= 85 ? 'text-emerald-600' : e.scoreMedio >= 65 ? 'text-amber-600' : 'text-rose-600'}`}>{e.scoreMedio}</span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {e.divergencias > 0 ? <span className="text-rose-600 font-bold">{e.divergencias}</span> : <span className="text-emerald-600">✓</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NCMs e CFOPs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card border rounded-xl p-3">
          <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Códigos NCM</p>
          <p className="text-xs">Únicos: <strong>{stats.ncmUnicos}</strong></p>
          {stats.ncmInvalidos.length > 0 && (
            <p className="text-xs text-rose-700 mt-1">
              NCMs inválidos/vazios: <strong>{stats.ncmInvalidos.length}</strong>
              <span className="block font-mono text-[10px] mt-1">{stats.ncmInvalidos.slice(0, 5).join(', ')}{stats.ncmInvalidos.length > 5 ? '…' : ''}</span>
            </p>
          )}
        </div>
        <div className="bg-card border rounded-xl p-3">
          <p className="text-xs font-bold uppercase text-muted-foreground mb-2">CFOPs utilizados</p>
          <p className="text-xs">Interestaduais (2xxx/6xxx): <strong>{stats.cfopsInterestaduais.length}</strong></p>
          <p className="text-xs">Internas (1xxx/5xxx): <strong>{stats.cfopsInternas.length}</strong></p>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono">{[...stats.cfopsInterestaduais, ...stats.cfopsInternas].sort().join(', ')}</p>
        </div>
      </div>

      {/* Top divergências críticas */}
      {stats.porSeveridade.alta > 0 && (
        <div>
          <p className="text-xs font-bold uppercase text-rose-700 mb-2">Divergências de alta severidade (exige ação)</p>
          <div className="bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b bg-rose-50">
                  <th className="text-left px-2 py-1.5">NF</th>
                  <th className="text-left px-2 py-1.5">Emitente</th>
                  <th className="text-left px-2 py-1.5">Produto</th>
                  <th className="text-left px-2 py-1.5">Observação</th>
                </tr>
              </thead>
              <tbody>
                {stats.todasDivergenciasFiscais.filter(d => d.severidade === 'alta').slice(0, 30).map((d, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-2 py-1.5">{d.nf || '—'}</td>
                    <td className="px-2 py-1.5 max-w-[180px] truncate">{d.emit || '—'}</td>
                    <td className="px-2 py-1.5 max-w-[180px] truncate">{d.produto}</td>
                    <td className="px-2 py-1.5">{d.observacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center pt-3 border-t">
        Relatório gerado em {formatDate(new Date().toISOString().slice(0, 10))} · Validações baseadas em legislação vigente (CST/CSOSN, CFOP, NCM, alíquotas interestaduais, consistência aritmética).
      </p>
    </div>
  );
}