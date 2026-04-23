import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Repeat, Plus, Sparkles, AlertTriangle, CheckCircle, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency } from '../lib/formatters';
import { sugerirRegras } from '../lib/recurringEngine.js';

const CATEGORIAS = ['aluguel','energia','agua','internet','telefone','software_saas','seguro','contabilidade','streaming','assinatura','domínio_hosting','outro'];
const EMPRESAS = ['NeuralTec', 'Liesch'];
const FORMAS = ['debito_automatico','boleto','pix','cartao','transferencia'];

const EMPTY = {
  nome: '', descricao_padrao: '', fornecedor: '', categoria: 'outro',
  valor_esperado: 0, tolerancia_percentual: 10, dia_vencimento: 10,
  forma_pagamento: 'debito_automatico', empresa: 'NeuralTec', ativa: true,
};

export default function DespesasRecorrentes() {
  const [regras, setRegras] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [sugestoesOpen, setSugestoesOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [rs, ls] = await Promise.all([
      base44.entities.RegraRecorrente.list('-created_date', 200),
      base44.entities.LancamentoBancario.list('-data', 1000),
    ]);
    setRegras(rs);
    setLancamentos(ls);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const sugestoes = useMemo(() => sugerirRegras(lancamentos, regras), [lancamentos, regras]);

  async function salvar() {
    if (!form.nome || !form.descricao_padrao || !form.valor_esperado) return;
    const payload = { ...form, valor_esperado: Number(form.valor_esperado), tolerancia_percentual: Number(form.tolerancia_percentual), dia_vencimento: Number(form.dia_vencimento) };
    if (form.id) {
      const { id, ...rest } = payload;
      await base44.entities.RegraRecorrente.update(id, rest);
    } else {
      await base44.entities.RegraRecorrente.create(payload);
    }
    setForm(null);
    load();
  }

  async function toggleAtiva(r) {
    await base44.entities.RegraRecorrente.update(r.id, { ativa: !r.ativa });
    load();
  }

  async function excluir(r) {
    if (!confirm(`Excluir regra "${r.nome}"?`)) return;
    await base44.entities.RegraRecorrente.delete(r.id);
    load();
  }

  async function criarDeSugestao(s) {
    setForm({
      ...EMPTY,
      nome: s.descricao_exemplo.slice(0, 40),
      descricao_padrao: s.chave,
      valor_esperado: s.valor_esperado,
      dia_vencimento: s.dia_vencimento,
      tolerancia_percentual: Math.max(10, Math.round(s.variacao_pct * 100) + 5),
    });
    setSugestoesOpen(false);
  }

  if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="Despesas Recorrentes" subtitle="Regras que ensinam o motor de conciliação a reconhecer débitos habituais">
        <Button variant="outline" onClick={() => setSugestoesOpen(true)} className="gap-2">
          <Sparkles className="w-4 h-4" /> Sugestões ({sugestoes.length})
        </Button>
        <Button onClick={() => setForm(EMPTY)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Regra
        </Button>
      </PageHeader>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-card rounded-xl border p-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Total de regras</p>
          <p className="text-xl font-bold">{regras.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3">
          <p className="text-[10px] font-bold uppercase text-emerald-700">Ativas</p>
          <p className="text-xl font-bold text-emerald-700">{regras.filter(r => r.ativa).length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3">
          <p className="text-[10px] font-bold uppercase text-blue-700">Valor mensal esperado</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(regras.filter(r => r.ativa).reduce((a, r) => a + (r.valor_esperado || 0), 0))}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
          <p className="text-[10px] font-bold uppercase text-amber-700">Sugestões detectadas</p>
          <p className="text-xl font-bold text-amber-700">{sugestoes.length}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Nome</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Padrão extrato</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Categoria</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor esperado</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Tolerância</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Dia</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Ocorrências</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Status</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {regras.map(r => (
                <tr key={r.id} className="border-b hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">
                    <p>{r.nome}</p>
                    {r.fornecedor && <p className="text-[10px] text-muted-foreground">{r.fornecedor}</p>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground font-mono text-[10px]">{r.descricao_padrao}</td>
                  <td className="px-3 py-2"><span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">{r.categoria}</span></td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{formatCurrency(r.valor_esperado)}</td>
                  <td className="px-3 py-2 text-center">±{r.tolerancia_percentual ?? 10}%</td>
                  <td className="px-3 py-2 text-center">dia {r.dia_vencimento || '—'}</td>
                  <td className="px-3 py-2 text-center font-bold">{r.total_ocorrencias || 0}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => toggleAtiva(r)} title={r.ativa ? 'Desativar' : 'Ativar'}>
                      {r.ativa ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setForm(r)}><Edit className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-rose-600" onClick={() => excluir(r)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {regras.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma regra cadastrada. Use "Sugestões" para criar a partir do histórico do extrato.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de formulário */}
      <Dialog open={!!form} onOpenChange={() => setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Repeat className="w-5 h-5" /> {form?.id ? 'Editar' : 'Nova'} Regra Recorrente</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome da regra *</Label>
                <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Aluguel Pavilhão" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Padrão na descrição do extrato *</Label>
                <Input value={form.descricao_padrao} onChange={e => setForm({ ...form, descricao_padrao: e.target.value })} placeholder="Ex: ALUGUEL ou VIVO FIBRA ou GOOGLE" />
                <p className="text-[10px] text-muted-foreground mt-1">O motor busca esse texto na descrição de cada débito (case-insensitive).</p>
              </div>
              <div>
                <Label className="text-xs">Fornecedor</Label>
                <Input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor esperado (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor_esperado} onChange={e => setForm({ ...form, valor_esperado: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Tolerância (%)</Label>
                <Input type="number" value={form.tolerancia_percentual} onChange={e => setForm({ ...form, tolerancia_percentual: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Dia habitual do débito</Label>
                <Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({ ...form, dia_vencimento: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Empresa</Label>
                <Select value={form.empresa} onValueChange={v => setForm({ ...form, empresa: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Observações</Label>
                <Input value={form.observacoes || ''} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button onClick={salvar}>Salvar Regra</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de sugestões */}
      <Dialog open={sugestoesOpen} onOpenChange={setSugestoesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Sugestões automáticas</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Padrões de débito repetidos em 2+ meses, com variação de valor &lt; 30%. Clique para criar a regra.
          </p>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {sugestoes.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-6">Nenhum padrão recorrente novo detectado.</p>}
            {sugestoes.map((s, i) => (
              <div key={i} className="border rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-muted/20">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{s.descricao_exemplo}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">padrão: {s.chave}</p>
                  <p className="text-[11px] mt-1">
                    <span className="font-bold">{formatCurrency(s.valor_esperado)}</span>
                    <span className="text-muted-foreground"> · {s.ocorrencias}x em {s.meses_distintos} meses · dia ~{s.dia_vencimento} · variação {(s.variacao_pct * 100).toFixed(1)}%</span>
                  </p>
                </div>
                <Button size="sm" onClick={() => criarDeSugestao(s)}>Criar regra</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}