import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, AlertTriangle, Check, Receipt, TrendingUp, Clock, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator, { ALL_MONTHS } from '../components/shared/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../lib/formatters';
import { getCurrentMonth } from '../lib/currentMonth';

const statusRowColors = {
  em_aberto: 'bg-orange-50/50',
  pago: 'bg-green-50/50',
  vencido: 'bg-red-50/50',
};

export default function Cobrancas() {
  const [titulos, setTitulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [quickFilter, setQuickFilter] = useState('todos');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isAnnual, setIsAnnual] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('data_vencimento');
  const [sortDir, setSortDir] = useState('asc');
  const [baixaId, setBaixaId] = useState(null);
  const [baixaValor, setBaixaValor] = useState('');
  const [form, setForm] = useState({
    nosso_numero: '', seu_numero: '', cliente: '', data_vencimento: '',
    data_pagamento: '', valor_titulo: '', valor_pago: '0', status: 'em_aberto',
    canal_cobranca: '', nota_fiscal_id: '', parcela_numero: '', parcela_total: ''
  });

  async function loadData() {
    setLoading(true);
    const data = await base44.entities.TituloCobranca.list('-data_vencimento', 500);
    setTitulos(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('neuralfinRefresh', handler);
    const unsub = base44.entities.TituloCobranca.subscribe(() => loadData());
    return () => { window.removeEventListener('neuralfinRefresh', handler); unsub(); };
  }, []);

  const monthTotals = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach(m => {
      t[m] = titulos.filter(n => n.data_vencimento?.startsWith(m)).reduce((s,n) => s+(n.valor_titulo||0), 0);
    });
    return t;
  }, [titulos]);

  // Helper: dias até o vencimento (negativo = vencido)
  const diasAteVenc = (dataVenc) => {
    if (!dataVenc) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const venc = new Date(dataVenc + 'T00:00:00');
    return Math.round((venc - hoje) / 86400000);
  };

  const filtered = useMemo(() => {
    const arr = titulos.filter(t => {
      // Filtro "vencendo esta semana" ignora filtro de mês — mostra todos nos próximos 7 dias
      if (quickFilter === 'semana') {
        if (t.status === 'pago') return false;
        const d = diasAteVenc(t.data_vencimento);
        if (d === null || d < 0 || d > 7) return false;
      } else {
        if (!isAnnual && !t.data_vencimento?.startsWith(selectedMonth)) return false;
        if (quickFilter === 'pagos' && t.status !== 'pago') return false;
        if (quickFilter === 'abertos' && t.status !== 'em_aberto') return false;
        if (quickFilter === 'vencidos' && t.status !== 'vencido') return false;
      }
      if (searchTerm && !t.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) && !t.nosso_numero?.includes(searchTerm)) return false;
      return true;
    });

    // Ordenação dinâmica
    const dir = sortDir === 'asc' ? 1 : -1;
    const getVal = (t) => {
      if (sortBy === 'parcela') return (t.parcela_numero || 0) * 1000 + (t.parcela_total || 0);
      return t[sortBy];
    };
    arr.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * dir;
    });
    return arr;
  }, [titulos, quickFilter, searchTerm, selectedMonth, isAnnual, sortBy, sortDir]);

  function toggleSort(field) {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir(field === 'data_vencimento' ? 'asc' : 'desc');
    }
  }

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <ChevronsUpDown className="w-3 h-3 inline-block opacity-30 ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 inline-block ml-1" />
      : <ChevronDown className="w-3 h-3 inline-block ml-1" />;
  };

  const totalEmitido = filtered.reduce((s, t) => s + (t.valor_titulo || 0), 0);
  const totalPago = filtered.filter(t => t.status === 'pago').reduce((s, t) => s + (t.valor_pago || 0), 0);
  const totalAberto = filtered.filter(t => t.status !== 'pago').reduce((s, t) => s + (t.valor_titulo || 0), 0);

  // Alerta agora mostra APENAS títulos em atraso (vencidos não pagos).
  // Vencimentos da semana já aparecem na listagem via filtro "Vencendo esta semana".
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const alertas = titulos
    .filter(t => {
      if (t.status === 'pago' || !t.data_vencimento) return false;
      const venc = new Date(t.data_vencimento + 'T00:00:00');
      return venc < today;
    })
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  const totalEmAtraso = alertas.reduce((s, a) => s + (a.valor_titulo || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    await base44.entities.TituloCobranca.create({
      ...form,
      valor_titulo: parseFloat(form.valor_titulo),
      valor_pago: form.valor_pago ? parseFloat(form.valor_pago) : 0,
      parcela_numero: form.parcela_numero ? parseInt(form.parcela_numero) : null,
      parcela_total: form.parcela_total ? parseInt(form.parcela_total) : null,
    });
    setShowForm(false);
    setForm({ nosso_numero: '', seu_numero: '', cliente: '', data_vencimento: '', data_pagamento: '', valor_titulo: '', valor_pago: '0', status: 'em_aberto', canal_cobranca: '', nota_fiscal_id: '', parcela_numero: '', parcela_total: '' });
    loadData();
  }

  async function darBaixa() {
    if (!baixaId || !baixaValor) return;
    await base44.entities.TituloCobranca.update(baixaId, {
      status: 'pago',
      valor_pago: parseFloat(baixaValor),
      data_pagamento: new Date().toISOString().split('T')[0],
    });
    setBaixaId(null);
    setBaixaValor('');
    loadData();
  }

  const countVencendoSemana = titulos.filter(t => {
    if (t.status === 'pago') return false;
    const d = diasAteVenc(t.data_vencimento);
    return d !== null && d >= 0 && d <= 7;
  }).length;

  const countByStatus = {
    todos: titulos.length,
    pagos: titulos.filter(t => t.status === 'pago').length,
    abertos: titulos.filter(t => t.status === 'em_aberto').length,
    vencidos: titulos.filter(t => t.status === 'vencido').length,
    semana: countVencendoSemana,
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Cobranças Sicredi" subtitle="Gestão de títulos e boletos">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo Título</Button>
      </PageHeader>

      {/* Alerta — APENAS títulos em atraso (vencidos não pagos) */}
      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">
              Títulos em atraso ({alertas.length}) — {formatCurrency(totalEmAtraso)}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {alertas.map(a => {
                const dias = Math.abs(diasAteVenc(a.data_vencimento));
                return (
                  <span key={a.id} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    {a.cliente} — {formatCurrency(a.valor_titulo)} — venc. {formatDate(a.data_vencimento)} <strong>({dias}d atraso)</strong>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <GradientCard title="Total Emitido" value={formatCurrency(totalEmitido)} sub="Boletos gerados" icon={Receipt} gradient="blue" />
        <GradientCard title="Recebido" value={formatCurrency(totalPago)} sub={`${totalEmitido > 0 ? ((totalPago/totalEmitido)*100).toFixed(1) : 0}% do emitido`} icon={TrendingUp} gradient="green" />
        <GradientCard title="Em Aberto" value={formatCurrency(totalAberto)} sub="Aguardando pagamento" icon={Clock} gradient="orange" />
      </div>

      {/* Quick filters + search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex rounded-lg border overflow-hidden">
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'abertos', label: 'Em Aberto' },
            { key: 'semana', label: 'Vencendo esta semana', highlight: true },
            { key: 'vencidos', label: 'Vencidos' },
            { key: 'pagos', label: 'Pagos' },
          ].map(f => {
            const isActive = quickFilter === f.key;
            const baseClass = isActive
              ? (f.highlight ? 'bg-red-600 text-white' : 'bg-primary text-primary-foreground')
              : (f.highlight ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-card text-muted-foreground hover:bg-muted');
            return (
              <button
                key={f.key}
                onClick={() => setQuickFilter(f.key)}
                className={`px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 ${baseClass}`}
              >
                {f.highlight && <AlertTriangle className="w-3 h-3" />}
                {f.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : f.highlight ? 'bg-red-200' : 'bg-muted'}`}>{countByStatus[f.key]}</span>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente ou nº..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
                <th onClick={() => toggleSort('nosso_numero')} className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">Nosso Nº<SortIcon field="nosso_numero" /></th>
                <th onClick={() => toggleSort('cliente')} className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">Cliente<SortIcon field="cliente" /></th>
                <th onClick={() => toggleSort('data_vencimento')} className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">Vencimento<SortIcon field="data_vencimento" /></th>
                <th onClick={() => toggleSort('parcela')} className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">Parcela<SortIcon field="parcela" /></th>
                <th onClick={() => toggleSort('valor_titulo')} className="text-right px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">Valor<SortIcon field="valor_titulo" /></th>
                <th onClick={() => toggleSort('valor_pago')} className="text-right px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">Pago<SortIcon field="valor_pago" /></th>
                <th onClick={() => toggleSort('status')} className="text-center px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">Status<SortIcon field="status" /></th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhum título encontrado</td></tr>
              ) : (
                filtered.map(t => {
                  const dias = diasAteVenc(t.data_vencimento);
                  const vencendoCritico = t.status !== 'pago' && dias !== null && dias >= 0 && dias <= 3;
                  const rowClass = vencendoCritico
                    ? 'bg-red-100/70 hover:bg-red-100 border-l-4 border-l-red-600'
                    : `${statusRowColors[t.status] || ''} hover:brightness-95`;
                  return (
                  <tr key={t.id} className={`border-b transition-colors ${rowClass}`}>
                    <td className={`px-4 py-3 font-medium ${vencendoCritico ? 'text-red-800' : ''}`}>{t.nosso_numero}</td>
                    <td className={`px-4 py-3 ${vencendoCritico ? 'text-red-800 font-semibold' : ''}`}>{t.cliente}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${vencendoCritico ? 'text-red-700 font-bold' : ''}`}>
                      {formatDate(t.data_vencimento)}
                      {vencendoCritico && (
                        <span className="ml-2 text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                          {dias === 0 ? 'HOJE' : `${dias}d`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{t.parcela_numero && t.parcela_total ? `${t.parcela_numero}/${t.parcela_total}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(t.valor_titulo)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">{formatCurrency(t.valor_pago)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-center">
                      {t.status !== 'pago' ? (
                        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => { setBaixaId(t.id); setBaixaValor(String(t.valor_titulo)); }}>
                          <Check className="w-3 h-3" /> Baixa
                        </Button>
                      ) : (
                        <span className="text-xs text-green-600">{formatDate(t.data_pagamento)}</span>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={4} className="px-4 py-3 font-semibold">Total ({filtered.length})</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(totalEmitido)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(totalPago)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Dar baixa modal */}
      <Dialog open={!!baixaId} onOpenChange={open => { if (!open) { setBaixaId(null); setBaixaValor(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dar Baixa no Título</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Valor Pago</Label><Input type="number" step="0.01" value={baixaValor} onChange={e => setBaixaValor(e.target.value)} /></div>
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
              <div><Label>Nosso Número</Label><Input value={form.nosso_numero} onChange={e => setForm({...form, nosso_numero: e.target.value})} required /></div>
              <div><Label>Seu Número</Label><Input value={form.seu_numero} onChange={e => setForm({...form, seu_numero: e.target.value})} /></div>
            </div>
            <div><Label>Cliente</Label><Input value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm({...form, data_vencimento: e.target.value})} required /></div>
              <div><Label>Valor Título</Label><Input type="number" step="0.01" value={form.valor_titulo} onChange={e => setForm({...form, valor_titulo: e.target.value})} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_aberto">Em Aberto</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Parcela Nº</Label><Input type="number" value={form.parcela_numero} onChange={e => setForm({...form, parcela_numero: e.target.value})} /></div>
              <div><Label>Total Parcelas</Label><Input type="number" value={form.parcela_total} onChange={e => setForm({...form, parcela_total: e.target.value})} /></div>
            </div>
            <Button type="submit" className="w-full">Salvar Título</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}