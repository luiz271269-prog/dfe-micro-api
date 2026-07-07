import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Palmtree, Plus, AlertTriangle, Trash2, CheckCircle2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { calcularSituacaoFerias, FERIAS_STATUS_CONFIG, SITUACAO_CONFIG } from '@/lib/feriasEngine';
import FeriasForm from './FeriasForm';
import SimuladorFerias from './SimuladorFerias';

export default function ControleFerias({ funcionarios }) {
  const [ferias, setFerias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSimulador, setShowSimulador] = useState(false);

  async function load() {
    const list = await base44.entities.FeriasFuncionario.list('-data_inicio_gozo', 500);
    setFerias(list);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const ativos = useMemo(() => funcionarios.filter((f) => f.status !== 'desligado'), [funcionarios]);

  const situacoes = useMemo(() => ativos.map((func) => ({
    func,
    ferias: ferias.filter((f) => f.funcionario_nome === func.nome),
    sit: calcularSituacaoFerias(func, ferias.filter((f) => f.funcionario_nome === func.nome)),
  })).sort((a, b) => (a.sit.diasParaLimite ?? 99999) - (b.sit.diasParaLimite ?? 99999)), [ativos, ferias]);

  const vencidas = situacoes.filter((s) => s.sit.status === 'vencida');
  const atencao = situacoes.filter((s) => s.sit.status === 'atencao');

  async function handleConcluir(f) {
    await base44.entities.FeriasFuncionario.update(f.id, { status: 'concluida' });
    load();
  }
  async function handleExcluir(f) {
    if (!confirm(`Excluir o registro de férias de ${f.funcionario_nome}?`)) return;
    await base44.entities.FeriasFuncionario.delete(f.id);
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const historico = ferias.slice().sort((a, b) => (b.data_inicio_gozo || '').localeCompare(a.data_inicio_gozo || ''));

  return (
    <div className="space-y-6">
      {/* Alertas de limite concessivo */}
      {(vencidas.length > 0 || atencao.length > 0) && (
        <div className="space-y-2">
          {vencidas.map(({ func, sit }) => (
            <div key={func.id} className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <p className="text-red-800"><b>{func.nome}</b>: limite concessivo venceu em <b>{formatDate(sit.limiteConcessivo)}</b> — férias devem ser pagas em dobro (CLT art. 137). Saldo: {sit.saldoDias} dias ({sit.pendentes} período(s)).</p>
            </div>
          ))}
          {atencao.map(({ func, sit }) => (
            <div key={func.id} className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
              <p className="text-yellow-800"><b>{func.nome}</b>: faltam <b>{sit.diasParaLimite} dias</b> para o limite concessivo ({formatDate(sit.limiteConcessivo)}). Programe as férias.</p>
            </div>
          ))}
        </div>
      )}

      {/* Situação por funcionário */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Situação por Funcionário</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowSimulador(true)} className="gap-2"><Calculator className="w-4 h-4" /> Simular Custo</Button>
            <Button size="sm" onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Registrar Férias</Button>
          </div>
        </div>
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Funcionário</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Admissão</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Direito (dias)</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Usados (dias)</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Saldo (dias)</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Limite Concessivo</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Próximas Férias</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Situação</th>
                </tr>
              </thead>
              <tbody>
                {situacoes.map(({ func, sit }) => {
                  const sc = SITUACAO_CONFIG[sit.status] || SITUACAO_CONFIG.sem_dados;
                  return (
                    <tr key={func.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-semibold">{func.nome}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(func.data_admissao)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{sit.diasDireito}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{sit.diasUsados}</td>
                      <td className={`px-3 py-2.5 text-center tabular-nums font-bold ${sit.saldoDias > 30 ? 'text-red-600' : sit.saldoDias > 0 ? 'text-orange-600' : 'text-green-700'}`}>{sit.saldoDias}</td>
                      <td className="px-3 py-2.5 text-xs">{sit.limiteConcessivo ? formatDate(sit.limiteConcessivo) : '—'}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {sit.proximaFerias ? `${formatDate(sit.proximaFerias.data_inicio_gozo)} → ${formatDate(sit.proximaFerias.data_fim_gozo)}` : sit.emGozo ? 'Em gozo agora' : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${sc.color}`}>{sc.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Histórico de férias registradas */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Férias Registradas</p>
        {historico.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
            <Palmtree className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma férias registrada ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historico.map((f) => {
              const sc = FERIAS_STATUS_CONFIG[f.status] || FERIAS_STATUS_CONFIG.planejada;
              return (
                <div key={f.id} className="flex flex-wrap items-center gap-3 bg-card border rounded-xl px-4 py-2.5 text-sm">
                  <Palmtree className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="font-semibold">{f.funcionario_nome}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(f.data_inicio_gozo)} → {formatDate(f.data_fim_gozo)} · {f.dias_gozo} dias{f.dias_abono > 0 ? ` + ${f.dias_abono} vendidos` : ''}</span>
                  {f.pagamento_adiantado && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">
                      Adiantado{f.data_pagamento ? ` em ${formatDate(f.data_pagamento)}` : ''}{f.valor_pago ? ` · ${formatCurrency(f.valor_pago)}` : ''}
                    </span>
                  )}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
                  <span className="ml-auto flex gap-1">
                    {f.status !== 'concluida' && f.status !== 'cancelada' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title="Marcar como concluída" onClick={() => handleConcluir(f)}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Excluir" onClick={() => handleExcluir(f)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FeriasForm open={showForm} onClose={() => setShowForm(false)} funcionarios={funcionarios} ferias={ferias} onSaved={load} />
      <SimuladorFerias open={showSimulador} onClose={() => setShowSimulador(false)} funcionarios={funcionarios} />
    </div>
  );
}