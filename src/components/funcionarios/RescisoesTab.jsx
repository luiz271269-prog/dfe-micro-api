import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { UserMinus, Plus, Trash2, Paperclip, FileWarning, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { TIPOS_RESCISAO } from '@/lib/rescisaoEngine';
import RescisaoForm from './RescisaoForm';
import HomologacaoRescisao from './HomologacaoRescisao';

const STATUS_RESCISAO = {
  pre_calculo: { label: 'Pré-cálculo', color: 'bg-yellow-100 text-yellow-700' },
  homologada: { label: 'Homologada', color: 'bg-blue-100 text-blue-700' },
  paga: { label: 'Paga', color: 'bg-green-100 text-green-700' },
};

export default function RescisoesTab({ funcionarios, onChanged }) {
  const [rescisoes, setRescisoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [homologando, setHomologando] = useState(null);

  async function load() {
    const list = await base44.entities.RescisaoFuncionario.list('-data_desligamento', 200);
    setRescisoes(list);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleExcluir(r) {
    if (!confirm(`Excluir a rescisão de ${r.funcionario_nome}?`)) return;
    await base44.entities.RescisaoFuncionario.delete(r.id);
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rescisões de Contrato</p>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Rescisão</Button>
      </div>

      {rescisoes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <UserMinus className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma rescisão registrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rescisoes.map((r) => {
            const sc = STATUS_RESCISAO[r.status] || STATUS_RESCISAO.pre_calculo;
            const verbas = [
              ['Saldo salário', r.saldo_salario], ['Aviso prévio', r.aviso_previo_valor],
              ['Férias vencidas +1/3', r.ferias_vencidas_valor], ['Férias prop. +1/3', r.ferias_proporcionais_valor],
              ['13º prop.', r.decimo_terceiro_valor], ['Multa FGTS', r.multa_fgts_valor],
              ['Outras', r.outros_valores],
            ].filter(([, v]) => v > 0);
            return (
              <div key={r.id} className="bg-card border rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <UserMinus className="w-4 h-4 text-red-500" />
                  <span className="font-semibold text-sm">{r.funcionario_nome}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(r.data_desligamento)} · {TIPOS_RESCISAO[r.tipo_rescisao] || r.tipo_rescisao} · aviso {r.aviso_previo}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
                  {!r.anexo_url && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700 inline-flex items-center gap-1">
                      <FileWarning className="w-3 h-3" /> Sem termo anexado
                    </span>
                  )}
                  {(r.homologada || r.status === 'homologada' || r.status === 'paga') ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 inline-flex items-center gap-1"><BadgeCheck className="w-3 h-3" /> Homologada</span>
                  ) : (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setHomologando(r)}>Anexar e homologar</Button>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <span className="font-bold text-primary">{formatCurrency(r.total_liquido)}</span>
                    {r.anexo_url && (
                      <a href={r.anexo_url} target="_blank" rel="noreferrer" title={r.anexo_nome || 'Ver anexo'}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600"><Paperclip className="w-4 h-4" /></Button>
                      </a>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Excluir" onClick={() => handleExcluir(r)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </span>
                </div>
                {verbas.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {verbas.map(([l, v]) => <span key={l}>{l}: <b className="text-foreground">{formatCurrency(v)}</b></span>)}
                    {r.descontos > 0 && <span className="text-red-600">Descontos: <b>-{formatCurrency(r.descontos)}</b></span>}
                  </div>
                )}
                {(r.tempo_casa_meses > 0 || r.ferias_pendentes_dias > 0) && (
                  <p className="text-xs text-muted-foreground mt-1">Base do pré-cálculo: {Math.floor((r.tempo_casa_meses || 0) / 12)} ano(s) e {(r.tempo_casa_meses || 0) % 12} mês(es) de casa · {r.ferias_pendentes_dias || 0} dias de férias pendentes{r.ferias_dobradas_dias > 0 ? ` (${r.ferias_dobradas_dias} dias em dobro)` : ''}.</p>
                )}
                {r.observacoes && <p className="text-xs text-muted-foreground italic mt-1">{r.observacoes}</p>}
              </div>
            );
          })}
        </div>
      )}

      <RescisaoForm open={showForm} onClose={() => setShowForm(false)} funcionarios={funcionarios} onSaved={() => { load(); onChanged?.(); }} />
      <HomologacaoRescisao rescisao={homologando} onClose={() => setHomologando(null)} onSaved={load} />
    </div>
  );
}