import { useEffect, useState, useMemo } from 'react';
import { relatorioPixFuncionarios } from '@/functions/relatorioPixFuncionarios';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, AlertTriangle, Search, ShieldCheck, CalendarRange } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import RelatorioPixLinha from './RelatorioPixLinha';
import StatCardAuditoriaPix from './rastreio/StatCardAuditoriaPix';
import ResumoMesesAuditoriaPix from './rastreio/ResumoMesesAuditoriaPix';
import PlanoCorrecaoPixPanel from './rastreio/PlanoCorrecaoPixPanel';

export default function RelatorioPixFuncionarios() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [janelaMeses, setJanelaMeses] = useState(12);
  const [competenciaFiltro, setCompetenciaFiltro] = useState(null);
  const [filtroClassificacao, setFiltroClassificacao] = useState('todos');

  async function load(meses = janelaMeses) {
    setLoading(true);
    setErro(null);
    try {
      const res = await relatorioPixFuncionarios({ meses });
      setDados(res?.data || null);
    } catch (err) {
      setErro(err.message);
    }
    setLoading(false);
  }
  useEffect(() => { load(janelaMeses); }, [janelaMeses]);

  const funcionariosFiltrados = useMemo(() => {
    if (!dados?.funcionarios) return [];
    return dados.funcionarios.map(f => {
      const comps = f.competencias.filter(c => {
        if (competenciaFiltro && c.competencia !== competenciaFiltro) return false;
        if (filtroClassificacao !== 'todos' && c.classificacao_auditoria !== filtroClassificacao) return false;
        return true;
      });
      return { ...f, competencias: comps };
    }).filter(f => f.competencias.length > 0);
  }, [dados, competenciaFiltro, filtroClassificacao]);

  function exportar() {
    const lines = [
      'Funcionário,Competência,Tipo,Devido,5º Dia Útil,7º Dia Útil (Vencimento),PIX Salário,PIX Complemento,PIX Comissão,Baixa Manual (Evidência Ind.),Vales,A Confirmar,Incompatível,Total Pago,Saldo,Situação,Classificação Auditoria,Data PIX Salário,Motivo Auditoria'
    ];
    funcionariosFiltrados.forEach(f => f.competencias.forEach(c => {
      lines.push([
        `"${f.funcionario}"`,
        c.competencia,
        c.tipo,
        c.liquido,
        c.janela_inicio || '',
        c.vencimento || '',
        c.pix_salario,
        c.pix_complemento,
        c.pix_comissao,
        c.baixa_manual || 0,
        c.pix_adiantamentos,
        c.pix_a_confirmar,
        c.pix_suspeito,
        c.total_pago,
        c.diferenca,
        c.situacao,
        c.classificacao_auditoria || '',
        c.data_salario || '',
        `"${(c.motivo_auditoria || '').replace(/"/g, '""')}"`
      ].join(','));
    }));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auditoria_pix_folha_${janelaMeses}m.csv`;
    a.click();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (erro) return <p className="text-sm text-red-600 py-8 text-center">Erro ao gerar relatório: {erro}</p>;
  if (!dados) return null;

  const t = dados.totais || {};
  const aud = dados.resumo_auditoria || {};
  const plano = dados.plano_correcao || [];
  const resumoMeses = dados.resumo_meses || [];

  return (
    <div className="space-y-6">
      {/* Cabeçalho da auditoria 12 meses */}
      <div className="bg-card rounded-xl border p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-base">Auditoria de Vínculos PIX da Folha — {dados.janela_auditoria?.label || 'Últimos 12 Meses'}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold">
                Modo Somente Leitura · Zero mutação
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Regra verificada: folha mensal paga via PIX entre o <b>5º e o 7º dia útil do mês subsequente</b> (ex.: folha 2026-10 vence a partir do 5º dia útil de 2026-11). Baixas manuais são preservadas como evidência independente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border bg-muted/30 p-0.5 text-xs">
            <button
              onClick={() => setJanelaMeses(12)}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${janelaMeses === 12 ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <CalendarRange className="w-3.5 h-3.5" /> Últimos 12 meses
            </button>
            <button
              onClick={() => setJanelaMeses(0)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${janelaMeses === 0 ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Histórico completo
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => load(janelaMeses)} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Exportar Auditoria CSV
          </Button>
        </div>
      </div>

      {/* Stat Cards com componente de biblioteca adaptado aos dados reais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardAuditoriaPix
          title="Folhas Auditadas (12m)"
          displayValue={String(aud.total_folhas ?? dados.funcionarios.reduce((s, f) => s + f.competencias.length, 0))}
          suffix="folhas"
          detail1Label="Devido no período"
          detail1Value={formatCurrency(t.devido || 0)}
          detail2Label="Janela"
          detail2Value={dados.janela_auditoria ? `${dados.janela_auditoria.inicio} → ${dados.janela_auditoria.fim}` : '12 meses'}
          tone="primary"
        />
        <StatCardAuditoriaPix
          title="Vínculos PIX Confirmados"
          displayValue={formatCurrency(t.pago_pix_extrato ?? t.pago ?? 0)}
          detail1Label="Folhas corretas"
          detail1Value={`${aud.corretos ?? 0} competência(s)`}
          detail2Label="Baixas manuais (ind.)"
          detail2Value={formatCurrency(t.baixa_manual_total || 0)}
          tone="success"
        />
        <StatCardAuditoriaPix
          title="PIX Candidatos (5º Dia Útil)"
          displayValue={String(aud.candidatos_sem_vinculo ?? 0)}
          suffix="pendentes"
          detail1Label="Valor no extrato"
          detail1Value={formatCurrency(aud.valor_candidatos ?? 0)}
          detail2Label="Sem vínculo"
          detail2Value={`${dados.pix_nao_rastreados?.length || 0} PIX nominais`}
          tone="warning"
        />
        <StatCardAuditoriaPix
          title="Revisar / Duplicidades"
          displayValue={String((aud.revisar ?? 0) + (aud.duplicidades ?? 0))}
          suffix="casos"
          detail1Label="Vale no 5º DU / Outros"
          detail1Value={`${aud.revisar ?? 0} vínculo(s)`}
          detail2Label="Possível duplicidade"
          detail2Value={`${aud.duplicidades ?? 0} caso(s)`}
          tone="danger"
        />
      </div>

      {/* Resumo por mês dos 12 meses com estado de cobertura */}
      <ResumoMesesAuditoriaPix
        meses={resumoMeses}
        competenciaFiltro={competenciaFiltro}
        onSelectCompetencia={setCompetenciaFiltro}
      />

      {/* Plano de Correção proposto item a item */}
      <PlanoCorrecaoPixPanel
        plano={plano}
        competenciaFiltro={competenciaFiltro}
      />

      {/* Filtro de categorias da lista por funcionário */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="font-semibold text-muted-foreground mr-1">Filtrar competências por diagnóstico:</span>
          {[
            ['todos', 'Todas'],
            ['correto', 'Corretas (5º–7º DU)'],
            ['candidato_sem_vinculo', 'Com PIX candidato'],
            ['revisar', 'Revisar vínculo / tipo'],
            ['possivel_duplicidade', 'Possível duplicidade'],
            ['parcial', 'Parciais'],
            ['sem_evidencia', 'Sem evidência'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFiltroClassificacao(k)}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${filtroClassificacao === k ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {competenciaFiltro && (
          <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">
            Competência filtrada: {competenciaFiltro}
          </span>
        )}
      </div>

      {/* Detalhamento por funcionário e competência */}
      {funcionariosFiltrados.map(f => (
        <div key={f.funcionario} className="bg-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px]">
                {f.funcionario.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <p className="font-bold text-sm">{f.funcionario}</p>
            </div>
            <div className="flex gap-4 text-xs tabular-nums flex-wrap">
              <span>Devido: <b>{formatCurrency(f.total_liquido)}</b></span>
              <span className="text-green-700">PIX Confirmado: <b>{formatCurrency(f.total_pago_pix ?? f.total_pago)}</b></span>
              {(f.total_baixa_manual || 0) > 0 && <span className="text-indigo-700">Baixa manual (ind.): <b>{formatCurrency(f.total_baixa_manual)}</b></span>}
              {f.total_adiantamentos > 0 && <span className="text-yellow-700">Vales: <b>{formatCurrency(f.total_adiantamentos)}</b></span>}
            </div>
          </div>
          {f.competencias.map(c => <RelatorioPixLinha key={`${c.competencia}-${c.tipo}-${c.folha_id || ''}`} comp={c} />)}
        </div>
      ))}

      {dados.pix_nao_rastreados?.length > 0 && (
        <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-yellow-200 bg-yellow-100/60 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-700" />
            <p className="font-bold text-sm text-yellow-900">
              {dados.pix_nao_rastreados.length} PIX nominal(is) no extrato sem vínculo em nenhuma folha — {formatCurrency(dados.pix_nao_rastreados.reduce((s, p) => s + p.valor, 0))}
            </p>
          </div>
          <div className="divide-y divide-yellow-200 max-h-72 overflow-y-auto">
            {dados.pix_nao_rastreados.map((p, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3 text-xs flex-wrap">
                <span className="font-mono text-muted-foreground w-20 shrink-0">{formatDate(p.data)}</span>
                <span className="font-semibold w-44 shrink-0 truncate">{p.funcionario}</span>
                {p.competencia_sugerida && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 font-bold shrink-0">
                    Candidato p/ {p.competencia_sugerida} {p.na_janela_quinto_dia ? '(5º–7º DU)' : ''}
                  </span>
                )}
                <span className="flex-1 truncate text-muted-foreground">{p.descricao}</span>
                <span className="font-bold tabular-nums shrink-0">{formatCurrency(p.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {funcionariosFiltrados.length === 0 && (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma folha encontrada para os filtros selecionados</p>
        </div>
      )}
    </div>
  );
}