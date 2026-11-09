import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ACAO_PLANO_CORRECAO } from '../rastreioPixRotulos';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Download, ShieldAlert, Filter } from 'lucide-react';

export default function PlanoCorrecaoPixPanel({ plano = [], competenciaFiltro }) {
  const [filtroAcao, setFiltroAcao] = useState('todos');

  const itensFiltrados = plano.filter(item => {
    if (competenciaFiltro && item.competencia !== competenciaFiltro) return false;
    if (filtroAcao !== 'todos' && item.acao !== filtroAcao) return false;
    return true;
  });

  function exportarPlanoCSV() {
    const header = [
      'Competência',
      'Funcionário',
      'Ação Proposta',
      'Grau de Evidência',
      '5º Dia Útil Esperado',
      'Data PIX / Baixa',
      'Valor Folha (R$)',
      'Valor PIX / Baixa (R$)',
      'Vínculo Atual',
      'PIX / Evidência Encontrada',
      'Motivo e Regra Aplicada',
    ].join(',');
    const rows = itensFiltrados.map(it => [
      it.competencia,
      `"${(it.funcionario || '').replace(/"/g, '""')}"`,
      `"${(ACAO_PLANO_CORRECAO[it.acao]?.label || it.acao || '').replace(/"/g, '""')}"`,
      it.grau_evidencia || 'alta',
      it.quinto_dia_util || '',
      it.data_evento || '',
      it.valor_folha ?? '',
      it.valor_evento ?? '',
      `"${(it.vinculo_atual || '').replace(/"/g, '""')}"`,
      `"${(it.evidencia_descricao || '').replace(/"/g, '""')}"`,
      `"${(it.motivo || '').replace(/"/g, '""')}"`,
    ].join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plano_correcao_pix_12m${competenciaFiltro ? `_${competenciaFiltro}` : ''}.csv`;
    a.click();
  }

  const contagensPorAcao = plano.reduce((acc, it) => {
    if (competenciaFiltro && it.competencia !== competenciaFiltro) return acc;
    acc[it.acao] = (acc[it.acao] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          <div>
            <h3 className="font-bold text-sm">
              Plano de Correção Proposto (Somente Leitura) — {itensFiltrados.length} apontamento(s)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Nenhum vínculo ou baixa manual foi removido ou alterado. Baixas manuais permanecem como evidência independente.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportarPlanoCSV} disabled={!itensFiltrados.length} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar Plano CSV
        </Button>
      </div>

      {/* Filtros rápidos por tipo de ação */}
      <div className="px-4 py-2.5 border-b bg-muted/10 flex items-center gap-2 flex-wrap text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
          <Filter className="w-3.5 h-3.5" /> Filtrar ação:
        </span>
        <button
          onClick={() => setFiltroAcao('todos')}
          className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${filtroAcao === 'todos' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          Todos ({Object.values(contagensPorAcao).reduce((a, b) => a + b, 0)})
        </button>
        {Object.entries(ACAO_PLANO_CORRECAO).map(([key, cfg]) => {
          const count = contagensPorAcao[key] || 0;
          if (!count) return null;
          return (
            <button
              key={key}
              onClick={() => setFiltroAcao(filtroAcao === key ? 'todos' : key)}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${filtroAcao === key ? 'ring-2 ring-primary ' + cfg.badge : cfg.badge}`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {itensFiltrados.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Nenhuma divergência ou correção pendente para o filtro selecionado.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card border-b z-10">
              <tr className="text-muted-foreground bg-muted/20">
                <th className="text-left px-3 py-2 font-semibold">Comp.</th>
                <th className="text-left px-3 py-2 font-semibold">Funcionário</th>
                <th className="text-left px-3 py-2 font-semibold">Ação Recomendada</th>
                <th className="text-left px-3 py-2 font-semibold">5º DU Esperado</th>
                <th className="text-left px-3 py-2 font-semibold">Data Real</th>
                <th className="text-right px-3 py-2 font-semibold">Líquido</th>
                <th className="text-right px-3 py-2 font-semibold">Valor PIX/Baixa</th>
                <th className="text-left px-3 py-2 font-semibold">Estado Atual → Evidência / Justificativa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {itensFiltrados.map((it, idx) => {
                const ac = ACAO_PLANO_CORRECAO[it.acao] || { label: it.acao, badge: 'bg-slate-100 text-slate-800' };
                return (
                  <tr key={idx} className="hover:bg-muted/20 align-top">
                    <td className="px-3 py-2.5 font-mono font-bold whitespace-nowrap">{it.competencia}</td>
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{it.funcionario}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold ${ac.badge}`}>
                        {ac.label}
                      </span>
                      <span className="ml-1.5 text-[10px] uppercase font-mono text-muted-foreground">
                        [{it.grau_evidencia || 'alta'}]
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                      {it.quinto_dia_util ? formatDate(it.quinto_dia_util) : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                      {it.data_evento ? formatDate(it.data_evento) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium whitespace-nowrap">
                      {it.valor_folha != null ? formatCurrency(it.valor_folha) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold whitespace-nowrap">
                      {it.valor_evento != null ? formatCurrency(it.valor_evento) : '—'}
                    </td>
                    <td className="px-3 py-2.5 min-w-[280px]">
                      <div className="font-medium text-foreground">{it.evidencia_descricao || it.vinculo_atual}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-start gap-1">
                        <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                        <span>{it.motivo}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}