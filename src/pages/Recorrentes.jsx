import { useMemo, useState } from 'react';
import { addMonths, format } from 'date-fns';
import PeriodoRecorrentes from '@/components/recorrentes/PeriodoRecorrentes';
import FrequenciaRecorrente from '@/components/recorrentes/FrequenciaRecorrente';
import CriarRegraExtratoDialog from '@/components/recorrentes/CriarRegraExtratoDialog';
import ConciliarRecorrentesDialog from '@/components/recorrentes/ConciliarRecorrentesDialog';
import ColunasDespesas from '@/components/recorrentes/ColunasDespesas';
import useRecorrentesData from '@/components/recorrentes/useRecorrentesData';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Repeat, Plus, Sparkles, Edit, Trash2, Power, AlertTriangle, CheckCircle } from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import SortableTh from '../components/shared/SortableTh';
import useTableSort from '@/hooks/useTableSort';
import { formatCurrency, formatDate } from '../lib/formatters';
import { aprenderPadroes, aplicarRegra } from '../lib/recurringEngine';
import SeletorClassificacao from '../components/shared/SeletorClassificacao';
import CampoClassificacao from '../components/shared/CampoClassificacao';

const EMPRESAS = ['NeuralTec','Liesch'];
const FORMAS = ['pix','boleto','debito_automatico','cartao','transferencia'];

const vazio = {
  nome: '', padrao_descricao: '', fornecedor: '', valor_esperado: '',
  tolerancia_percentual: 5, dia_vencimento: '', categoria: 'outro',
  origem_compra: 'empresa', tipo_compra: 'despesas',
  empresa: 'NeuralTec', forma_pagamento: 'pix', is_ativa: true, observacoes: '',
  frequencia: 'mensal', data_inicio: '', mes_inicio: '', conta_bancaria: '',
};

export default function Recorrentes() {
  const [mes, setMes] = useState(() => format(new Date(), 'yyyy-MM'));
  const [modo, setModo] = useState('mes');
  const { regras, lancs, cartoes, loading, error, load } = useRecorrentesData(mes);
  const [extratoOpen, setExtratoOpen] = useState(false);
  const [conciliarOpen, setConciliarOpen] = useState(false);
  const [formErro, setFormErro] = useState('');
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(vazio);
  const [saving, setSaving] = useState(false);
  const [sugestoesOpen, setSugestoesOpen] = useState(false);

  const inicio = modo === 'ano' ? `${mes.slice(0, 4)}-01` : modo === '12meses' ? format(addMonths(new Date(`${mes}-01T12:00:00`), -11), 'yyyy-MM') : mes;
  const fim = modo === 'ano' ? `${mes.slice(0, 4)}-12` : mes;
  const lancsPeriodo = useMemo(() => lancs.filter(l => l.data?.slice(0, 7) >= inicio && l.data?.slice(0, 7) <= fim), [lancs, inicio, fim]);
  const cartoesNormalizados = useMemo(() => cartoes.filter(l => (l.valor || 0) > 0).map(l => ({ ...l, data: l.data_lancamento, descricao: l.estabelecimento, detalhe: l.observacao, valor: -l.valor, conta_bancaria: '', fonte: 'Cartão' })), [cartoes]);
  const baseRecorrencias = useMemo(() => [...lancs, ...cartoesNormalizados], [lancs, cartoesNormalizados]);
  const despesasConsolidadas = useMemo(() => {
    const extrato = lancsPeriodo.filter(l => l.valor < 0).map(l => ({ key: `e-${l.id}`, descricao: l.descricao, data: l.data, valor: Math.abs(l.valor), categoria: l.categoria, fonte: 'Extrato', fixa: regras.some(r => r.is_ativa && aplicarRegra(l, r).match) }));
    const cartao = cartoesNormalizados.filter(l => l.data?.slice(0, 7) >= inicio && l.data?.slice(0, 7) <= fim).map(l => {
      return { key: `c-${l.id}`, descricao: l.descricao, data: l.data, valor: Math.abs(l.valor), categoria: l.categoria, fonte: 'Cartão', fixa: regras.some(r => r.is_ativa && aplicarRegra(l, r).match) };
    });
    const todos = [...extrato, ...cartao].sort((a, b) => b.data.localeCompare(a.data));
    return { fixas: todos.filter(l => l.fixa), variaveis: todos.filter(l => !l.fixa) };
  }, [lancsPeriodo, cartoesNormalizados, inicio, fim, regras]);
  const totaisMes = useMemo(() => {
    const totais = {};
    const elegiveis = [
      ...lancs.filter(l => l.valor < 0).map(l => ({ data: l.data, valor: Math.abs(l.valor) })),
      ...cartoesNormalizados.map(l => ({ data: l.data, valor: Math.abs(l.valor) })),
    ];
    for (const l of elegiveis) if (l.data) totais[l.data.slice(0, 7)] = (totais[l.data.slice(0, 7)] || 0) + l.valor;
    return totais;
  }, [lancs, cartoesNormalizados]);

  const sugestoes = useMemo(() => aprenderPadroes(baseRecorrencias, regras), [baseRecorrencias, regras]);

  // Stats por regra no histórico atual
  const statsPorRegra = useMemo(() => {
    const mapa = {};
    regras.forEach(r => {
      const ocorrencias = baseRecorrencias.filter(l => l.valor < 0 && l.data?.slice(0, 7) >= inicio && l.data?.slice(0, 7) <= fim).map(l => ({ l, m: aplicarRegra(l, r) })).filter(x => x.m.match);
      const divergentes = ocorrencias.filter(x => x.m.status === 'divergente').length;
      const ultimoMatch = ocorrencias.map(x => x.l).sort((a, b) => b.data.localeCompare(a.data))[0];
      mapa[r.id] = { total: ocorrencias.length, divergentes, ultimoMatch, valor: ocorrencias.reduce((s, x) => s + Math.abs(x.l.valor), 0) };
    });
    return mapa;
  }, [regras, baseRecorrencias, inicio, fim]);

  const { sorted, sortField, sortDir, handleSort } = useTableSort(regras, 'nome', 'asc');

  function abrirNovo() { setFormErro(''); setForm({ ...vazio, mes_inicio: mes }); setEditando('novo'); }
  function criarPeloExtrato(l) {
    setFormErro('');
    setForm({ ...vazio, nome: l.descricao, padrao_descricao: l.descricao, fornecedor: l.descricao, valor_esperado: Math.abs(l.valor), dia_vencimento: Number(l.data.slice(8, 10)), data_inicio: l.data, mes_inicio: l.data.slice(0, 7), conta_bancaria: l.conta_bancaria || '', origem_compra: l.origem_compra || 'empresa', tipo_compra: l.tipo_compra || 'despesas', categoria: l.categoria || 'outro' });
    setExtratoOpen(false); setEditando('novo');
  }
  function abrirEditar(r) {
    setFormErro('');
    setForm({ ...vazio, ...r });
    setEditando(r.id);
  }
  function aceitarSugestao(s) {
    setFormErro('');
    setForm({
      ...vazio,
      nome: s.nome,
      padrao_descricao: s.padrao_descricao,
      valor_esperado: s.valor_esperado,
      tolerancia_percentual: s.tolerancia_percentual,
      dia_vencimento: s.dia_vencimento,
    });
    setEditando('novo');
    setSugestoesOpen(false);
  }

  async function salvar() {
    setFormErro('');
    if (!(Number(form.valor_esperado) > 0) || !form.origem_compra || !['estoque', 'despesas', 'impostos', 'folha', 'obras', 'pro_labore'].includes(form.tipo_compra)) { setFormErro('Informe um valor positivo e complete a classificação.'); return; }
    if (form.frequencia === 'semanal' && !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(form.data_inicio || '')) { setFormErro('Informe a data inicial da recorrência semanal.'); return; }
    if (['trimestral', 'anual'].includes(form.frequencia) && !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.mes_inicio || '')) { setFormErro('Informe o mês inicial da recorrência.'); return; }
    if (form.dia_vencimento && (Number(form.dia_vencimento) < 1 || Number(form.dia_vencimento) > 31)) { setFormErro('O dia esperado deve estar entre 1 e 31.'); return; }
    if (Number(form.tolerancia_percentual) < 0 || Number(form.tolerancia_percentual) > 100) { setFormErro('Use tolerância de 0 a 100%.'); return; }
    const normalizar = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (regras.some(r => r.id !== editando && normalizar(r.padrao_descricao) === normalizar(form.padrao_descricao) && (r.conta_bancaria || '') === (form.conta_bancaria || '') && (r.frequencia || 'mensal') === form.frequencia)) { setFormErro('Já existe uma regra com este padrão, conta e frequência. Edite a existente.'); return; }
    setSaving(true);
    try {
      const { id, created_date, updated_date, created_by, created_by_id, ...campos } = form;
      const data = { ...campos, nome: form.nome.trim(), padrao_descricao: form.padrao_descricao.trim(), valor_esperado: Number(form.valor_esperado), tolerancia_percentual: Number(form.tolerancia_percentual), dia_vencimento: parseInt(form.dia_vencimento) || null };
      if (editando === 'novo') await base44.entities.RegraRecorrente.create(data);
      else await base44.entities.RegraRecorrente.update(editando, data);
      setEditando(null);
      await load();
    } catch (e) { setFormErro(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  }

  async function toggleAtiva(r) {
    await base44.entities.RegraRecorrente.update(r.id, { is_ativa: !r.is_ativa });
    load();
  }
  async function excluir(r) {
    if (!confirm(`Excluir regra "${r.nome}"?`)) return;
    await base44.entities.RegraRecorrente.delete(r.id);
    load();
  }

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;
  if (error) return <div className="p-8 text-center text-destructive"><p>{error.message}</p><Button onClick={() => load()}>Tentar novamente</Button></div>;

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Despesas Recorrentes" subtitle="Regras que o motor de conciliação usa para vincular automaticamente débitos repetitivos">
        <Button variant="outline" onClick={() => setSugestoesOpen(true)} className="gap-2">
          <Sparkles className="w-4 h-4" /> Aprender do Extrato e Cartão ({sugestoes.length})
        </Button>
        <Button variant="outline" onClick={() => setExtratoOpen(true)}>Criar pelo extrato</Button>
        <Button variant="outline" onClick={() => setConciliarOpen(true)}>Conciliar regras cadastradas</Button>
        <Button onClick={abrirNovo} className="gap-2"><Plus className="w-4 h-4" /> Nova Regra</Button>
      </PageHeader>
      <PeriodoRecorrentes mes={mes} modo={modo} onMes={setMes} onModo={setModo} totais={totaisMes} />

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold text-indigo-900 mb-1 flex items-center gap-2">
          <Repeat className="w-4 h-4" /> Como funcionam as regras
        </p>
        <p className="text-xs text-indigo-800 leading-relaxed">
          Cada regra observa débitos do extrato que contenham a <strong>palavra-chave</strong> e estão próximos do <strong>valor esperado</strong> (dentro da tolerância).
          A frequência e o mês inicial definem os meses previstos. Use <strong>Conciliar regras cadastradas</strong> para revisar os débitos do período e confirmar o vínculo com uma despesa; divergências ficam bloqueadas para revisão.
        </p>
      </div>

      <ColunasDespesas fixas={despesasConsolidadas.fixas} variaveis={despesasConsolidadas.variaveis} />

      <h2 className="text-sm font-bold mb-2">Regras cadastradas</h2>
      {regras.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <Repeat className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Nenhuma regra cadastrada ainda.</p>
          <Button onClick={() => setSugestoesOpen(true)} className="gap-2">
            <Sparkles className="w-4 h-4" /> Aprender automaticamente do extrato
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <SortableTh field="nome" className="py-2" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Regra</SortableTh>
                  <SortableTh field="categoria" className="py-2" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Classificação</SortableTh>
                  <SortableTh field="padrao_descricao" className="py-2" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Padrão</SortableTh>
                  <SortableTh field="valor_esperado" align="right" className="py-2" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Valor esperado</SortableTh>
                  <SortableTh field="tolerancia_percentual" align="center" className="py-2" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Tol.</SortableTh>
                  <SortableTh field="dia_vencimento" align="center" className="py-2" sortField={sortField} sortDir={sortDir} onSort={handleSort}>Dia</SortableTh>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Frequência</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor no período</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Ocorrências</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Última</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Status</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const s = statsPorRegra[r.id] || {};
                  return (
                    <tr key={r.id} className={`border-b transition-colors ${r.is_ativa ? 'bg-blue-50/80 hover:bg-blue-100/80' : 'bg-muted/20 opacity-50 hover:bg-muted/40'}`}>
                      <td className="px-3 py-2">
                        <p className="font-semibold">{r.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{r.empresa || '—'}</p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <SeletorClassificacao eixo="origem" entityName="RegraRecorrente" record={r} field="origem_compra" onChange={() => load()} />
                          <SeletorClassificacao eixo="tipo" entityName="RegraRecorrente" record={r} field="tipo_compra" onChange={() => load()} />
                          <SeletorClassificacao eixo="categoria" entityName="RegraRecorrente" record={r} field="categoria" onChange={() => load()} />
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground max-w-[180px] truncate">{r.padrao_descricao}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{formatCurrency(r.valor_esperado)}</td>
                      <td className="px-3 py-2 text-center">±{r.tolerancia_percentual}%</td>
                      <td className="px-3 py-2 text-center">{r.dia_vencimento || '—'}</td>
                      <td className="px-3 py-2 text-center">{{ semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual' }[r.frequencia || 'mensal']}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{formatCurrency(s.valor || 0)}</td>
                      <td className="px-3 py-2 text-center font-bold">{s.total || 0}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{s.ultimoMatch ? formatDate(s.ultimoMatch.data) : '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {s.divergentes > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-bold">
                            <AlertTriangle className="w-3 h-3" /> {s.divergentes} div.
                          </span>
                        ) : s.total > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold">
                            <CheckCircle className="w-3 h-3" /> OK
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Sem match</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => toggleAtiva(r)} title={r.is_ativa ? 'Desativar' : 'Ativar'}>
                            <Power className={`w-3 h-3 ${r.is_ativa ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => abrirEditar(r)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => excluir(r)}>
                            <Trash2 className="w-3 h-3 text-rose-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CriarRegraExtratoDialog key={`${inicio}-${fim}`} open={extratoOpen} onOpenChange={setExtratoOpen} lancamentos={lancsPeriodo} onEscolher={criarPeloExtrato} />
      <ConciliarRecorrentesDialog key={`conciliar-${inicio}-${fim}`} open={conciliarOpen} onOpenChange={setConciliarOpen} lancamentos={lancsPeriodo} regras={regras} onRefresh={load} />
      {/* Modal Form */}
      <Dialog open={!!editando} onOpenChange={() => { if (!saving) setEditando(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editando === 'novo' ? 'Nova Regra Recorrente' : 'Editar Regra'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome da regra</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Aluguel Pavilhão" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Palavra-chave da descrição no extrato</Label>
              <Input value={form.padrao_descricao} onChange={e => setForm({ ...form, padrao_descricao: e.target.value })} placeholder="Ex: ALUGUEL SILVA" />
              <p className="text-[10px] text-muted-foreground mt-1">O motor verifica se cada palavra (len &gt; 2) aparece na descrição do débito.</p>
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Valor esperado (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_esperado} onChange={e => setForm({ ...form, valor_esperado: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Tolerância (%)</Label>
              <Input type="number" value={form.tolerancia_percentual} onChange={e => setForm({ ...form, tolerancia_percentual: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Dia do mês esperado</Label>
              <Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({ ...form, dia_vencimento: e.target.value })} />
            </div>
            <FrequenciaRecorrente form={form} onChange={setForm} />
            <CampoClassificacao eixo="origem" label="Quem comprou (centro de custo)" value={form.origem_compra} onChange={v => setForm({ ...form, origem_compra: v })} />
            <CampoClassificacao eixo="tipo" label="Tipo de compra" value={form.tipo_compra} onChange={v => setForm({ ...form, tipo_compra: v })} />
            <CampoClassificacao eixo="categoria" label="Categoria (plano de contas)" value={form.categoria} onChange={v => setForm({ ...form, categoria: v })} />
            <div>
              <Label className="text-xs">Empresa</Label>
              <Select value={form.empresa} onValueChange={v => setForm({ ...form, empresa: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMPRESAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Observações</Label>
              <Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          {formErro && <p role="alert" className="text-xs text-destructive">{formErro}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" disabled={saving} onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving || !form.nome || !form.padrao_descricao}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Sugestões */}
      <Dialog open={sugestoesOpen} onOpenChange={setSugestoesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Padrões aprendidos do extrato e cartão</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Débitos do extrato e compras do cartão com descrição similar e valor consistente em ≥2 meses. Estornos e pagamentos de fatura são ignorados.
          </p>
          {sugestoes.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-8">Nenhum padrão novo detectado. Todas as recorrências já têm regra.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {sugestoes.map((s, i) => (
                <div key={i} className="border rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.ocorrencias} ocorrências em {s.meses_distintos} meses · dia ~{s.dia_vencimento} · tolerância sugerida ±{s.tolerancia_percentual}%
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">Amostra: {s.amostra.map(a => formatCurrency(Math.abs(a.valor))).join(' · ')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(s.valor_esperado)}</p>
                    <Button size="sm" className="mt-1 h-7 text-[11px]" onClick={() => aceitarSugestao(s)}>
                      <Plus className="w-3 h-3 mr-1" /> Criar regra
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}