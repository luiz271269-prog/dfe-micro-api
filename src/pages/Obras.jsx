import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Hammer, Building2, Wrench } from 'lucide-react';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator, { ALL_MONTHS } from '../components/shared/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/shared/PageHeader';
import SeletorClassificacao from '../components/shared/SeletorClassificacao';
import CampoClassificacao from '../components/shared/CampoClassificacao';
import { formatCurrency, formatDate } from '../lib/formatters';
import { getCurrentMonth } from '../lib/currentMonth';

const LOCAIS = [
  { value: 'pavilhao', label: 'Pavilhão', color: 'blue' },
  { value: 'loja', label: 'Loja', color: 'green' },
  { value: 'terraco', label: 'Terraço', color: 'purple' },
  { value: 'escritorio', label: 'Escritório', color: 'slate' },
  { value: 'deposito', label: 'Depósito', color: 'orange' },
  { value: 'infra', label: 'Infra', color: 'yellow' },
  { value: 'outro', label: 'Outro', color: 'slate' },
];

const PROFISSIONAIS = [
  { value: 'serralheiro', label: 'Serralheiro' },
  { value: 'pedreiro', label: 'Pedreiro' },
  { value: 'pintor', label: 'Pintor' },
  { value: 'vidros', label: 'Vidros' },
  { value: 'eletricista', label: 'Eletricista' },
  { value: 'hidraulico', label: 'Hidráulico' },
  { value: 'material', label: 'Material' },
  { value: 'outros', label: 'Outros' },
];

const ETAPAS = [
  { value: 'planejamento', label: 'Planejamento' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'pausada', label: 'Pausada' },
];

const EMPTY_FORM = {
  data: '', local_obra: 'loja', tipo: 'mao_obra', tipo_profissional: 'pedreiro',
  responsavel: '', descricao: '', orcamento: '', valor: '',
  forma_pagamento: '', numero_nota: '', etapa_obra: 'concluida', fornecedor_cnpj_cpf: '',
  origem_compra: 'empresa', tipo_compra: 'obras'
};

function LocalCard({ local, obras }) {
  const items = obras.filter(o => o.local_obra === local.value);
  const total = items.reduce((s, o) => s + (o.valor || 0), 0);
  const orcado = items.reduce((s, o) => s + (o.orcamento || 0), 0);
  const max = Math.max(total, orcado, 1);
  const colorMap = { blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500', slate: 'bg-slate-400', orange: 'bg-orange-500', yellow: 'bg-yellow-500' };
  const bar = colorMap[local.color] || 'bg-blue-500';
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-xs font-semibold text-muted-foreground">{local.label}</p>
      <p className="text-xl font-bold mt-1">{formatCurrency(total)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{items.length} registro(s)</p>
      <div className="mt-2 w-full bg-muted rounded-full h-2">
        <div className={`${bar} rounded-full h-2 transition-all`} style={{ width: `${Math.min((total / max) * 100, 100)}%` }} />
      </div>
    </div>
  );
}

function OrcadoRealizadoBar({ local, obras }) {
  const items = obras.filter(o => o.local_obra === local.value);
  const realizado = items.reduce((s, o) => s + (o.valor || 0), 0);
  const orcado = items.reduce((s, o) => s + (o.orcamento || 0), 0);
  if (orcado === 0 && realizado === 0) return null;
  const max = Math.max(orcado, realizado, 1);
  const estourou = realizado > orcado && orcado > 0;
  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-sm">{local.label}</p>
        {orcado > 0 && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estourou ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {estourou ? '⚠ Estourou' : '✓ No orçado'}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
            <span>Orçado</span><span>{formatCurrency(orcado)}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-slate-400 rounded-full h-2" style={{ width: `${Math.min((orcado / max) * 100, 100)}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
            <span>Realizado</span><span>{formatCurrency(realizado)}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className={`rounded-full h-2 ${estourou ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min((realizado / max) * 100, 100)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Obras() {
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isAnnual, setIsAnnual] = useState(false);
  const [filterLocal, setFilterLocal] = useState('all');
  const [filterProf, setFilterProf] = useState('all');
  const [filterEtapa, setFilterEtapa] = useState('all');
  const [filterMes, setFilterMes] = useState('all');
  const [search, setSearch] = useState('');

  async function loadData() {
    setLoading(true);
    const data = await base44.entities.ObraReforma.list('-data', 500);
    setObras(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('neuralfinRefresh', handler);
    const unsub = base44.entities.ObraReforma.subscribe(() => loadData());
    return () => { window.removeEventListener('neuralfinRefresh', handler); unsub(); };
  }, []);

  const meses = useMemo(() => {
    const set = new Set(obras.map(o => o.data?.slice(0, 7)).filter(Boolean));
    return [...set].sort().reverse();
  }, [obras]);

  const filtered = useMemo(() => {
    return obras.filter(o => {
      if (!isAnnual && !o.data?.startsWith(selectedMonth)) return false;
      if (filterLocal !== 'all' && o.local_obra !== filterLocal) return false;
      if (filterProf !== 'all' && o.tipo_profissional !== filterProf) return false;
      if (filterEtapa !== 'all' && o.etapa_obra !== filterEtapa) return false;
      if (filterMes !== 'all' && !o.data?.startsWith(filterMes)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!o.responsavel?.toLowerCase().includes(q) && !o.descricao?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [obras, filterLocal, filterProf, filterEtapa, filterMes, search, selectedMonth, isAnnual]);

  const totalRealizado = filtered.reduce((s, o) => s + (o.valor || 0), 0);
  const totalOrcado = filtered.reduce((s, o) => s + (o.orcamento || 0), 0);

  const mainLocais = LOCAIS.filter(l => ['pavilhao', 'loja', 'terraco'].includes(l.value));

  const monthTotals = useMemo(() => {
    const t = {};
    obras.forEach(o => {
      const m = o.data?.slice(0, 7);
      if (m) t[m] = (t[m] || 0) + (o.valor || 0);
    });
    return t;
  }, [obras]);

  async function handleSubmit(e) {
    e.preventDefault();
    await base44.entities.ObraReforma.create({
      ...form,
      valor: parseFloat(form.valor) || 0,
      orcamento: form.orcamento ? parseFloat(form.orcamento) : undefined,
    });
    setShowForm(false);
    setForm(EMPTY_FORM);
    loadData();
  }

  const localLabel = (v) => LOCAIS.find(l => l.value === v)?.label || v;
  const profLabel = (v) => PROFISSIONAIS.find(p => p.value === v)?.label || v;
  const etapaLabel = (v) => ETAPAS.find(e => e.value === v)?.label || v;

  const etapaColor = (v) => ({
    concluida: 'bg-green-100 text-green-700',
    em_andamento: 'bg-blue-100 text-blue-700',
    planejamento: 'bg-yellow-100 text-yellow-700',
    pausada: 'bg-slate-100 text-slate-600',
  }[v] || 'bg-slate-100 text-slate-600');

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Obras e Reformas" subtitle="Controle de despesas por local e profissional">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Despesa de Obra</Button>
      </PageHeader>

      {/* Seção 1 — Resumo por local principal */}
      <p className="text-xs font-bold text-white uppercase tracking-wider mb-3 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600">📍 Resumo por Local</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {mainLocais.map(l => <LocalCard key={l.value} local={l} obras={obras} />)}
      </div>

      {/* Seção 2 — Resumo por tipo de profissional */}
      <p className="text-xs font-bold text-white uppercase tracking-wider mb-3 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600">🔧 Resumo por Especialidade</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
        {PROFISSIONAIS.map(p => {
          const items = obras.filter(o => o.tipo_profissional === p.value);
          const total = items.reduce((s, o) => s + (o.valor || 0), 0);
          return (
            <div key={p.value} className="bg-card rounded-xl border p-3 text-center">
              <p className="text-xs font-semibold text-muted-foreground">{p.label}</p>
              <p className="text-sm font-bold mt-1">{formatCurrency(total)}</p>
              <p className="text-xs text-muted-foreground">{items.length} reg.</p>
            </div>
          );
        })}
      </div>

      {/* Seção 5 — Orçado vs Realizado */}
      <p className="text-xs font-bold text-white uppercase tracking-wider mb-3 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600">📊 Orçado × Realizado por Local</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {mainLocais.map(l => <OrcadoRealizadoBar key={l.value} local={l} obras={obras} />)}
      </div>

      {/* Seção 3 — Filtros + Tabela */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar responsável/descrição..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterLocal} onValueChange={setFilterLocal}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Local" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os locais</SelectItem>
            {LOCAIS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProf} onValueChange={setFilterProf}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Profissional" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {PROFISSIONAIS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEtapa} onValueChange={setFilterEtapa}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas etapas</SelectItem>
            {ETAPAS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMes} onValueChange={setFilterMes}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {meses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Data</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Local</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Profissional</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Tipo</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Responsável</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Descrição</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Quem comprou</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Tipo de compra</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Orçado</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Realizado</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Dif.</th>
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Etapa</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Pgto</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={13} className="text-center py-12 text-muted-foreground">Nenhum registro encontrado</td></tr>
              ) : filtered.map(o => {
                const dif = (o.orcamento || 0) - (o.valor || 0);
                return (
                  <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(o.data)}</td>
                    <td className="px-3 py-2.5"><span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded">{localLabel(o.local_obra)}</span></td>
                    <td className="px-3 py-2.5 text-xs">{profLabel(o.tipo_profissional)}</td>
                    <td className="px-3 py-2.5 text-xs">{o.tipo === 'mao_obra' ? 'Mão de Obra' : 'Material'}</td>
                    <td className="px-3 py-2.5">{o.responsavel}</td>
                    <td className="px-3 py-2.5 max-w-[200px] truncate" title={o.descricao}>{o.descricao}</td>
                    <td className="px-3 py-2.5">
                      <SeletorClassificacao eixo="origem" entityName="ObraReforma" record={o} field="origem_compra" />
                    </td>
                    <td className="px-3 py-2.5">
                      <SeletorClassificacao eixo="tipo" entityName="ObraReforma" record={o} field="tipo_compra" />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{o.orcamento ? formatCurrency(o.orcamento) : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatCurrency(o.valor)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums text-xs font-semibold ${!o.orcamento ? 'text-muted-foreground' : dif >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {o.orcamento ? formatCurrency(dif) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${etapaColor(o.etapa_obra)}`}>{etapaLabel(o.etapa_obra)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{o.forma_pagamento}</td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={8} className="px-3 py-3 font-semibold">{filtered.length} registro(s)</td>
                  <td className="px-3 py-3 text-right font-bold text-muted-foreground">{formatCurrency(totalOrcado)}</td>
                  <td className="px-3 py-3 text-right font-bold">{formatCurrency(totalRealizado)}</td>
                  <td className={`px-3 py-3 text-right font-bold text-xs ${totalOrcado > 0 ? (totalOrcado - totalRealizado >= 0 ? 'text-green-600' : 'text-red-600') : 'text-muted-foreground'}`}>
                    {totalOrcado > 0 ? formatCurrency(totalOrcado - totalRealizado) : '—'}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal Nova Despesa */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Despesa de Obra</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} required /></div>
              <div>
                <Label>Local</Label>
                <Select value={form.local_obra} onValueChange={v => setForm({...form, local_obra: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOCAIS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Especialidade / Profissional</Label>
                <Select value={form.tipo_profissional} onValueChange={v => setForm({...form, tipo_profissional: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROFISSIONAIS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mao_obra">Mão de Obra</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Responsável / Fornecedor</Label><Input value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})} /></div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <CampoClassificacao eixo="origem" label="Quem comprou" value={form.origem_compra} onChange={v => setForm({...form, origem_compra: v})} />
              <CampoClassificacao eixo="tipo" label="Tipo de compra" value={form.tipo_compra} onChange={v => setForm({...form, tipo_compra: v})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor Orçado (R$)</Label><Input type="number" step="0.01" value={form.orcamento} onChange={e => setForm({...form, orcamento: e.target.value})} /></div>
              <div><Label>Valor Realizado (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Etapa</Label>
                <Select value={form.etapa_obra} onValueChange={v => setForm({...form, etapa_obra: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ETAPAS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Forma de Pagamento</Label><Input value={form.forma_pagamento} onChange={e => setForm({...form, forma_pagamento: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Número Nota Fiscal</Label><Input value={form.numero_nota} onChange={e => setForm({...form, numero_nota: e.target.value})} /></div>
              <div><Label>CPF / CNPJ Prestador</Label><Input value={form.fornecedor_cnpj_cpf} onChange={e => setForm({...form, fornecedor_cnpj_cpf: e.target.value})} /></div>
            </div>
            <Button type="submit" className="w-full">Salvar Despesa</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}