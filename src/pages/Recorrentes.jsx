import { useEffect, useMemo, useState } from 'react';
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
};

export default function Recorrentes() {
  const [regras, setRegras] = useState([]);
  const [lancs, setLancs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(vazio);
  const [saving, setSaving] = useState(false);
  const [sugestoesOpen, setSugestoesOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [r, l] = await Promise.all([
      base44.entities.RegraRecorrente.list('-created_date', 200),
      base44.entities.LancamentoBancario.list('-data', 1000),
    ]);
    setRegras(r); setLancs(l); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const sugestoes = useMemo(() => aprenderPadroes(lancs, regras), [lancs, regras]);

  // Stats por regra no histórico atual
  const statsPorRegra = useMemo(() => {
    const mapa = {};
    regras.forEach(r => {
      const matches = lancs.filter(l => l.valor < 0).map(l => aplicarRegra(l, r)).filter(m => m.match);
      const divergentes = matches.filter(m => m.status === 'divergente').length;
      const ultimoMatch = matches.length > 0
        ? lancs.filter(l => l.valor < 0).map((l, i) => ({ l, m: aplicarRegra(l, r) })).filter(x => x.m.match).sort((a, b) => (a.l.data > b.l.data ? -1 : 1))[0]?.l
        : null;
      mapa[r.id] = { total: matches.length, divergentes, ultimoMatch };
    });
    return mapa;
  }, [regras, lancs]);

  const { sorted, sortField, sortDir, handleSort } = useTableSort(regras, 'nome', 'asc');

  function abrirNovo() { setForm(vazio); setEditando('novo'); }
  function abrirEditar(r) {
    setForm({ ...vazio, ...r });
    setEditando(r.id);
  }
  function aceitarSugestao(s) {
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
    setSaving(true);
    const data = {
      ...form,
      valor_esperado: parseFloat(form.valor_esperado) || 0,
      tolerancia_percentual: parseFloat(form.tolerancia_percentual) || 5,
      dia_vencimento: parseInt(form.dia_vencimento) || null,
    };
    if (editando === 'novo') await base44.entities.RegraRecorrente.create(data);
    else await base44.entities.RegraRecorrente.update(editando, data);
    setSaving(false);
    setEditando(null);
    load();
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

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Despesas Recorrentes" subtitle="Regras que o motor de conciliação usa para vincular automaticamente débitos repetitivos">
        <Button variant="outline" onClick={() => setSugestoesOpen(true)} className="gap-2">
          <Sparkles className="w-4 h-4" /> Aprender do Extrato ({sugestoes.length})
        </Button>
        <Button onClick={abrirNovo} className="gap-2"><Plus className="w-4 h-4" /> Nova Regra</Button>
      </PageHeader>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold text-indigo-900 mb-1 flex items-center gap-2">
          <Repeat className="w-4 h-4" /> Como funcionam as regras
        </p>
        <p className="text-xs text-indigo-800 leading-relaxed">
          Cada regra observa débitos do extrato que contenham a <strong>palavra-chave</strong> e estão próximos do <strong>valor esperado</strong> (dentro da tolerância).
          O motor sugere o vínculo automaticamente na <strong>Conciliação 360°</strong> e alerta quando o valor vem divergente (ex: reajuste de aluguel).
        </p>
      </div>

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
                    <tr key={r.id} className={`border-b hover:bg-muted/20 ${!r.is_ativa ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2">
                        <p className="font-semibold">{r.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{r.empresa || '—'}</p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <SeletorClassificacao eixo="origem" entityName="RegraRecorrente" record={r} field="origem_compra" />
                          <SeletorClassificacao eixo="tipo" entityName="RegraRecorrente" record={r} field="tipo_compra" />
                          <SeletorClassificacao eixo="categoria" entityName="RegraRecorrente" record={r} field="categoria" />
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground max-w-[180px] truncate">{r.padrao_descricao}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{formatCurrency(r.valor_esperado)}</td>
                      <td className="px-3 py-2 text-center">±{r.tolerancia_percentual}%</td>
                      <td className="px-3 py-2 text-center">{r.dia_vencimento || '—'}</td>
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

      {/* Modal Form */}
      <Dialog open={!!editando} onOpenChange={() => setEditando(null)}>
        <DialogContent className="max-w-2xl">
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
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving || !form.nome || !form.padrao_descricao}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Sugestões */}
      <Dialog open={sugestoesOpen} onOpenChange={setSugestoesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Padrões aprendidos do extrato</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Débitos com descrição similar e valor consistente em ≥2 meses. Clique em "Criar regra" para transformar em regra recorrente.
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