import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Receipt, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator, { ALL_MONTHS } from '../components/shared/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../lib/formatters';

const CATEGORIAS = ['aluguel','energia','agua','internet','telefone','manutencao','limpeza','marketing','contabilidade','juridico','seguro','transporte','alimentacao','material_escritorio','outro'];
const FORMAS_PAG = ['pix','boleto','cartao','debito_automatico','dinheiro','transferencia'];
const EMPRESAS = ['NeuralTec','Liesch'];

const categoriaColors = {
  aluguel: 'bg-blue-100 text-blue-700', energia: 'bg-yellow-100 text-yellow-700',
  agua: 'bg-cyan-100 text-cyan-700', internet: 'bg-indigo-100 text-indigo-700',
  telefone: 'bg-purple-100 text-purple-700', manutencao: 'bg-orange-100 text-orange-700',
  limpeza: 'bg-teal-100 text-teal-700', marketing: 'bg-pink-100 text-pink-700',
  contabilidade: 'bg-green-100 text-green-700', juridico: 'bg-red-100 text-red-700',
  seguro: 'bg-slate-100 text-slate-700', transporte: 'bg-amber-100 text-amber-700',
  alimentacao: 'bg-lime-100 text-lime-700', material_escritorio: 'bg-violet-100 text-violet-700',
  outro: 'bg-slate-100 text-slate-600',
};

const EMPTY_FORM = {
  data: '', descricao: '', fornecedor: '', categoria: 'aluguel',
  valor: '', forma_pagamento: 'pix', status: 'pago',
  data_vencimento: '', empresa: 'NeuralTec', recorrente: false, observacoes: ''
};

export default function Despesas() {
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-04');
  const [isAnnual, setIsAnnual] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadData() {
    setLoading(true);
    const data = await base44.entities.DespesaOperacional.list('-data', 500);
    setDespesas(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('neuralfinRefresh', handler);
    return () => window.removeEventListener('neuralfinRefresh', handler);
  }, []);

  const monthTotals = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach(m => {
      t[m] = despesas.filter(d => d.data?.startsWith(m)).reduce((s, d) => s + (d.valor || 0), 0);
    });
    return t;
  }, [despesas]);

  const despesasMes = useMemo(() => {
    if (isAnnual) return despesas;
    return despesas.filter(d => d.data?.startsWith(selectedMonth));
  }, [despesas, selectedMonth, isAnnual]);

  const filtered = useMemo(() => {
    return despesasMes.filter(d => {
      if (filterCategoria !== 'all' && d.categoria !== filterCategoria) return false;
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      if (searchTerm && !d.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) && !d.fornecedor?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [despesasMes, filterCategoria, filterStatus, searchTerm]);

  const totalMes = despesasMes.reduce((s, d) => s + (d.valor || 0), 0);
  const totalPago = despesasMes.filter(d => d.status === 'pago').reduce((s, d) => s + (d.valor || 0), 0);
  const totalPendente = despesasMes.filter(d => d.status !== 'pago').reduce((s, d) => s + (d.valor || 0), 0);

  // Totais por categoria no mês
  const porCategoria = useMemo(() => {
    const t = {};
    despesasMes.forEach(d => { t[d.categoria] = (t[d.categoria] || 0) + (d.valor || 0); });
    return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [despesasMes]);

  async function handleSubmit(e) {
    e.preventDefault();
    await base44.entities.DespesaOperacional.create({
      ...form,
      valor: parseFloat(form.valor),
    });
    setShowForm(false);
    setForm(EMPTY_FORM);
    loadData();
    window.dispatchEvent(new Event('neuralfinRefresh'));
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Despesas Operacionais" subtitle="Controle de gastos e despesas fixas/variáveis">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Despesa</Button>
      </PageHeader>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <GradientCard title="Total do Mês" value={formatCurrency(totalMes)} sub={`${despesasMes.length} despesas`} icon={TrendingDown} gradient="red" />
        <GradientCard title="Pago" value={formatCurrency(totalPago)} sub={`${despesasMes.filter(d=>d.status==='pago').length} itens`} icon={CheckCircle} gradient="green" />
        <GradientCard title="Pendente / Vencido" value={formatCurrency(totalPendente)} sub={`${despesasMes.filter(d=>d.status!=='pago').length} itens`} icon={AlertTriangle} gradient={totalPendente > 0 ? 'orange' : 'teal'} />
        <div className="bg-white dark:bg-card border rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top Categorias</p>
          <div className="space-y-1">
            {porCategoria.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : porCategoria.map(([cat, val]) => (
              <div key={cat} className="flex justify-between text-xs">
                <span className={`px-1.5 py-0.5 rounded-full font-semibold ${categoriaColors[cat] || 'bg-slate-100 text-slate-600'}`}>{cat}</span>
                <span className="font-bold text-foreground">{formatCurrency(val)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar descrição ou fornecedor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g,' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Data</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descrição</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Fornecedor</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Categoria</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Empresa</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Forma Pag.</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhuma despesa encontrada</td></tr>
              ) : filtered.map(d => (
                <tr key={d.id} className={`border-b hover:bg-muted/30 transition-colors ${d.status === 'vencido' ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{formatDate(d.data)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{d.descricao}</p>
                    {d.recorrente && <p className="text-xs text-muted-foreground">🔄 Recorrente</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{d.fornecedor || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoriaColors[d.categoria] || 'bg-slate-100 text-slate-700'}`}>
                      {(d.categoria || '').replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs hidden md:table-cell">{d.empresa || '—'}</td>
                  <td className="px-4 py-3 text-xs hidden lg:table-cell">{d.forma_pagamento || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600">{formatCurrency(d.valor)}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={6} className="px-4 py-3 font-semibold">Total ({filtered.length} itens)</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(filtered.reduce((s,d)=>s+(d.valor||0),0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Despesa Operacional</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data *</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} required /></div>
              <div>
                <Label>Empresa</Label>
                <Select value={form.empresa} onValueChange={v => setForm({...form, empresa: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required /></div>
            <div><Label>Fornecedor / Beneficiário</Label><Input value={form.fornecedor} onChange={e => setForm({...form, fornecedor: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria *</Label>
                <Select value={form.categoria} onValueChange={v => setForm({...form, categoria: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={v => setForm({...form, forma_pagamento: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAS_PAG.map(f => <SelectItem key={f} value={f}>{f.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm({...form, data_vencimento: e.target.value})} /></div>
              <div className="flex items-center gap-2 mt-6">
                <input type="checkbox" id="recorrente" checked={form.recorrente} onChange={e => setForm({...form, recorrente: e.target.checked})} className="w-4 h-4" />
                <Label htmlFor="recorrente">Recorrente</Label>
              </div>
            </div>
            <Button type="submit" className="w-full">Salvar Despesa</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}