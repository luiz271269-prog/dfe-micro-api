import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, AlertTriangle, Check, Receipt, TrendingUp, Clock } from 'lucide-react';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator, { ALL_MONTHS } from '../components/shared/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import SortableTh from '../components/shared/SortableTh';
import DedupTitulosButton from '../components/cobrancas/DedupTitulosButton';
import ReconciliarOrfaosButton from '../components/cobrancas/ReconciliarOrfaosButton';
import { formatCurrency, formatDate } from '../lib/formatters';
import { getCurrentMonth } from '../lib/currentMonth';
import MensagemLink from '../components/shared/MensagemLink';

const statusRowColors = {
  em_aberto: 'bg-orange-50/50',
  pago: 'bg-green-50/50',
  vencido: 'bg-red-50/50'
};

const effectiveStatus = (titulo) => {
  if (titulo.status === 'pago') return 'pago';
  if (!titulo.data_vencimento) return titulo.status;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return new Date(`${titulo.data_vencimento}T00:00:00`) < hoje ? 'vencido' : 'em_aberto';
};

export default function Cobrancas() {
  const [titulos, setTitulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [quickFilter, setQuickFilter] = useState('todos');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isAnnual, setIsAnnual] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [baixaId, setBaixaId] = useState(null);
  const [baixaValor, setBaixaValor] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'asc' });

  function handleSort(key) {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: 'data_vencimento', direction: 'asc' };
    });
  }
  const [form, setForm] = useState({
    nosso_numero: '', seu_numero: '', cliente: '', cliente_telefone: '', data_vencimento: '',
    data_pagamento: '', valor_titulo: '', valor_pago: '0', status: 'em_aberto',
    canal_cobranca: '', nota_fiscal_id: '', parcela_numero: '', parcela_total: ''
  });

  async function loadData() {
    setLoading(true);
    const data = await base44.entities.TituloCobranca.list('-data_vencimento', 5000);
    setTitulos(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('neuralfinRefresh', handler);
    const unsub = base44.entities.TituloCobranca.subscribe(() => loadData());
    return () => {window.removeEventListener('neuralfinRefresh', handler);unsub();};
  }, []);

  const monthTotals = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach((m) => {
      t[m] = titulos.filter((n) => n.data_vencimento?.startsWith(m)).reduce((s, n) => s + (n.valor_titulo || 0), 0);
    });
    return t;
  }, [titulos]);

  // Helper: dias até o vencimento (negativo = vencido)
  const diasAteVenc = (dataVenc) => {
    if (!dataVenc) return null;
    const hoje = new Date();hoje.setHours(0, 0, 0, 0);
    const venc = new Date(dataVenc + 'T00:00:00');
    return Math.round((venc - hoje) / 86400000);
  };

  const filtered = useMemo(() => {
    return titulos.filter((t) => {
      // Filtro "vencendo esta semana" ignora filtro de mês — mostra todos nos próximos 7 dias
      if (quickFilter === 'semana') {
        if (t.status === 'pago') return false;
        const d = diasAteVenc(t.data_vencimento);
        if (d === null || d < 0 || d > 7) return false;
      } else {
        const selectedYear = selectedMonth.slice(0, 4);
        if (isAnnual && !t.data_vencimento?.startsWith(selectedYear)) return false;
        if (quickFilter !== 'vencidos' && !isAnnual && !t.data_vencimento?.startsWith(selectedMonth)) return false;
        const status = effectiveStatus(t);
        if (quickFilter === 'pagos' && status !== 'pago') return false;
        if (quickFilter === 'abertos' && status !== 'em_aberto') return false;
        if (quickFilter === 'vencidos' && status !== 'vencido') return false;
      }
      if (searchTerm && !t.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) && !t.nosso_numero?.includes(searchTerm)) return false;
      return true;
    });
  }, [titulos, quickFilter, searchTerm, selectedMonth, isAnnual]);

  const sorted = useMemo(() => {
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;
    const numericKeys = new Set(['valor_titulo', 'valor_pago', 'parcela_numero']);
    const dateKeys = new Set(['data_vencimento', 'data_pagamento']);
    return [...filtered].sort((a, b) => {
      let va = key === 'status' ? effectiveStatus(a) : a[key];
      let vb = key === 'status' ? effectiveStatus(b) : b[key];
      if (numericKeys.has(key)) {va = Number(va || 0);vb = Number(vb || 0);} else
      if (dateKeys.has(key)) {va = va || '';vb = vb || '';} else
      {va = String(va ?? '').toLowerCase();vb = String(vb ?? '').toLowerCase();}
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return String(a.data_vencimento || '').localeCompare(String(b.data_vencimento || ''));
    });
  }, [filtered, sortConfig]);

  const totalEmitido = filtered.reduce((s, t) => s + (t.valor_titulo || 0), 0);
  const totalPago = filtered.filter((t) => t.status === 'pago').reduce((s, t) => s + (t.valor_pago || 0), 0);
  const totalAberto = filtered.filter((t) => t.status !== 'pago').reduce((s, t) => s + (t.valor_titulo || 0), 0);

  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const alertas = titulos.filter((t) => {
    if (t.status === 'pago') return false;
    const venc = new Date(t.data_vencimento + 'T00:00:00');
    return venc >= today && venc <= in7Days;
  });

  async function handleSubmit(e) {
    e.preventDefault();
    await base44.entities.TituloCobranca.create({
      ...form,
      valor_titulo: parseFloat(form.valor_titulo),
      valor_pago: form.valor_pago ? parseFloat(form.valor_pago) : 0,
      parcela_numero: form.parcela_numero ? parseInt(form.parcela_numero) : null,
      parcela_total: form.parcela_total ? parseInt(form.parcela_total) : null
    });
    setShowForm(false);
    setForm({ nosso_numero: '', seu_numero: '', cliente: '', cliente_telefone: '', data_vencimento: '', data_pagamento: '', valor_titulo: '', valor_pago: '0', status: 'em_aberto', canal_cobranca: '', nota_fiscal_id: '', parcela_numero: '', parcela_total: '' });
    loadData();
  }

  // Vincula o WhatsApp a todos os títulos do mesmo cliente
  async function vincularTelefoneCliente(cliente, tel) {
    await base44.entities.TituloCobranca.updateMany({ cliente }, { $set: { cliente_telefone: tel } });
    setTitulos(prev => prev.map(t => t.cliente === cliente ? { ...t, cliente_telefone: tel } : t));
  }

  async function darBaixa() {
    if (!baixaId || !baixaValor) return;
    await base44.entities.TituloCobranca.update(baixaId, {
      status: 'pago',
      valor_pago: parseFloat(baixaValor),
      data_pagamento: new Date().toISOString().split('T')[0]
    });
    setBaixaId(null);
    setBaixaValor('');
    loadData();
  }

  const countVencendoSemana = titulos.filter((t) => {
    if (t.status === 'pago') return false;
    const d = diasAteVenc(t.data_vencimento);
    return d !== null && d >= 0 && d <= 7;
  }).length;

  const countByStatus = {
    todos: titulos.length,
    pagos: titulos.filter((t) => effectiveStatus(t) === 'pago').length,
    abertos: titulos.filter((t) => effectiveStatus(t) === 'em_aberto').length,
    vencidos: titulos.filter((t) => effectiveStatus(t) === 'vencido').length,
    semana: countVencendoSemana
  };

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Cobranças Sicredi" subtitle="Gestão de títulos e boletos">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals} />
        
        <ReconciliarOrfaosButton onComplete={loadData} />
        <DedupTitulosButton onComplete={loadData} />
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo Título</Button>
      </PageHeader>

      {/* Alerta */}
      {alertas.length > 0 &&
      <div className="bg-amber-50 border border-amber-200 rounded-xl mb-6 flex items-start gap-3 px-4 py-5">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Vencimentos nos próximos 7 dias ({alertas.length})</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {alertas.map((a) =>
            <span key={a.id} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{a.cliente} — {formatCurrency(a.valor_titulo)} — {formatDate(a.data_vencimento)}</span>
            )}
            </div>
          </div>
        </div>
      }

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <GradientCard title="Total Emitido" value={formatCurrency(totalEmitido)} sub="Boletos gerados" icon={Receipt} gradient="blue" />
        <GradientCard title="Recebido" value={formatCurrency(totalPago)} sub={`${totalEmitido > 0 ? (totalPago / totalEmitido * 100).toFixed(1) : 0}% do emitido`} icon={TrendingUp} gradient="green" />
        <GradientCard title="Em Aberto" value={formatCurrency(totalAberto)} sub="Aguardando pagamento" icon={Clock} gradient="orange" />
      </div>

      {/* Quick filters + search */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-[hsl(var(--border))]">
        <div className="flex rounded-lg border overflow-hidden">
          {[
          { key: 'todos', label: 'Todos' },
          { key: 'abertos', label: 'Em Aberto' },
          { key: 'semana', label: 'Vencendo esta semana', highlight: true },
          { key: 'vencidos', label: 'Vencidos' },
          { key: 'pagos', label: 'Pagos' }].
          map((f) => {
            const isActive = quickFilter === f.key;
            const baseClass = isActive ?
            f.highlight ? 'bg-red-600 text-white' : 'bg-primary text-primary-foreground' :
            f.highlight ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-card text-muted-foreground hover:bg-muted';
            return (
              <button
                key={f.key}
                onClick={() => setQuickFilter(f.key)}
                className={`text-xs font-semibold transition-colors flex items-center gap-1.5 opacity-65 py-1 px-5 my-2 rounded-md text-[hsl(var(--destructive))] ${baseClass}`}>
                
                {f.highlight && <AlertTriangle className="w-3 h-3" />}
                {f.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : f.highlight ? 'bg-red-200' : 'bg-muted'}`}>{countByStatus[f.key]}</span>
              </button>);

          })}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente ou nº..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-[hsl(var(--background))]" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
                <SortableTh field="nosso_numero" sortField={sortConfig.key} sortDir={sortConfig.direction} onSort={handleSort}>Nosso Nº</SortableTh>
                <SortableTh field="cliente" sortField={sortConfig.key} sortDir={sortConfig.direction} onSort={handleSort}>Cliente</SortableTh>
                <SortableTh field="data_vencimento" sortField={sortConfig.key} sortDir={sortConfig.direction} onSort={handleSort}>Vencimento</SortableTh>
                <SortableTh field="parcela_numero" sortField={sortConfig.key} sortDir={sortConfig.direction} onSort={handleSort}>Parcela</SortableTh>
                <SortableTh field="valor_titulo" align="right" sortField={sortConfig.key} sortDir={sortConfig.direction} onSort={handleSort}>Valor</SortableTh>
                <SortableTh field="valor_pago" align="right" sortField={sortConfig.key} sortDir={sortConfig.direction} onSort={handleSort}>Pago</SortableTh>
                <SortableTh field="status" align="center" sortField={sortConfig.key} sortDir={sortConfig.direction} onSort={handleSort}>Status</SortableTh>
                <SortableTh field="data_pagamento" align="center" sortField={sortConfig.key} sortDir={sortConfig.direction} onSort={handleSort}>Ação / Pagamento</SortableTh>
              </tr>
            </thead>
            <tbody>
              {loading ?
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</td></tr> :
              sorted.length === 0 ?
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhum título encontrado</td></tr> :

              sorted.map((t) => {
                const dias = diasAteVenc(t.data_vencimento);
                const status = effectiveStatus(t);
                const vencida = status === 'vencido';
                const vencendoCritico = status !== 'pago' && dias !== null && dias >= 0 && dias <= 3;
                const rowClass = vencida ?
                'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-600' :
                vencendoCritico ?
                'bg-red-100/70 hover:bg-red-100 border-l-4 border-l-red-600' :
                `${statusRowColors[status] || ''} hover:brightness-95`;
                return (
                  <tr key={t.id} className={`border-b transition-colors ${rowClass}`}>
                    <td className={`px-4 py-3 font-medium ${vencendoCritico ? 'text-red-800' : ''}`}>{t.nosso_numero}</td>
                    <td className={`px-4 py-3 ${vencendoCritico ? 'text-red-800 font-semibold' : ''}`}>
                      <div className="flex items-center gap-2">{t.cliente}<MensagemLink phone={t.cliente_telefone} compact onVincular={(tel) => vincularTelefoneCliente(t.cliente, tel)} /></div>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap ${vencendoCritico ? 'text-red-700 font-bold' : ''}`}>
                      {formatDate(t.data_vencimento)}
                      {(vencida || vencendoCritico) &&
                      <span className="ml-2 text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                          {vencida ? `${Math.abs(dias)}d vencida` : dias === 0 ? 'HOJE' : `${dias}d`}
                        </span>
                      }
                    </td>
                    <td className="px-4 py-3">{t.parcela_numero && t.parcela_total ? `${t.parcela_numero}/${t.parcela_total}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(t.valor_titulo)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">{formatCurrency(t.valor_pago)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={status} /></td>
                    <td className="px-4 py-3 text-center">
                      {t.status !== 'pago' ?
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => {setBaixaId(t.id);setBaixaValor(String(t.valor_titulo));}}>
                          <Check className="w-3 h-3" /> Baixa
                        </Button> :

                      <span className="text-xs text-green-600">{formatDate(t.data_pagamento)}</span>
                      }
                    </td>
                  </tr>);

              })
              }
            </tbody>
            {filtered.length > 0 &&
            <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={4} className="px-4 py-3 font-semibold">Total ({filtered.length})</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(totalEmitido)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(totalPago)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            }
          </table>
        </div>
      </div>

      {/* Dar baixa modal */}
      <Dialog open={!!baixaId} onOpenChange={(open) => {if (!open) {setBaixaId(null);setBaixaValor('');}}}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dar Baixa no Título</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Valor Pago</Label><Input type="number" step="0.01" value={baixaValor} onChange={(e) => setBaixaValor(e.target.value)} /></div>
            <Button className="w-full" onClick={darBaixa}>Confirmar Baixa</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Título de Cobrança</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nosso Número</Label><Input value={form.nosso_numero} onChange={(e) => setForm({ ...form, nosso_numero: e.target.value })} required /></div>
              <div><Label>Seu Número</Label><Input value={form.seu_numero} onChange={(e) => setForm({ ...form, seu_numero: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Cliente</Label><Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} required /></div>
              <div><Label>WhatsApp do cliente</Label><Input placeholder="(51) 99999-9999" value={form.cliente_telefone} onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} required /></div>
              <div><Label>Valor Título</Label><Input type="number" step="0.01" value={form.valor_titulo} onChange={(e) => setForm({ ...form, valor_titulo: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_aberto">Em Aberto</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Parcela Nº</Label><Input type="number" value={form.parcela_numero} onChange={(e) => setForm({ ...form, parcela_numero: e.target.value })} /></div>
              <div><Label>Total Parcelas</Label><Input type="number" value={form.parcela_total} onChange={(e) => setForm({ ...form, parcela_total: e.target.value })} /></div>
            </div>
            <Button type="submit" className="w-full">Salvar Título</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

}