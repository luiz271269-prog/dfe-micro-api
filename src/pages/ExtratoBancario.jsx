import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Filter } from 'lucide-react';
import MonthNavigator, { ALL_MONTHS } from '../components/shared/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency, formatDate, categoriaLabels } from '../lib/formatters';

export default function ExtratoBancario() {
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState('all');
  const [filterMes, setFilterMes] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('2026-03');
  const [isAnnual, setIsAnnual] = useState(false);
  const [form, setForm] = useState({
    data: '', descricao: '', valor: '', categoria: 'recebimento',
    saldo_apos: '', conta_bancaria: 'NeuralTec 36092-2', detalhe: '', mes_referencia: ''
  });

  async function loadData() {
    setLoading(true);
    const data = await base44.entities.LancamentoBancario.list('-data', 500);
    setLancamentos(data);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    return lancamentos.filter(l => {
      if (!isAnnual) {
        const mes = l.mes_referencia || l.data?.slice(0,7);
        if (mes !== selectedMonth) return false;
      }
      if (filterCategoria !== 'all' && l.categoria !== filterCategoria) return false;
      if (filterMes !== 'all' && l.mes_referencia !== filterMes) return false;
      if (searchTerm && !l.descricao?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [lancamentos, filterCategoria, filterMes, searchTerm, selectedMonth, isAnnual]);

  const totais = useMemo(() => {
    const cats = {};
    filtered.forEach(l => {
      cats[l.categoria] = (cats[l.categoria] || 0) + (l.valor || 0);
    });
    return cats;
  }, [filtered]);

  const totalGeral = filtered.reduce((s, l) => s + (l.valor || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    await base44.entities.LancamentoBancario.create({
      ...form,
      valor: parseFloat(form.valor),
      saldo_apos: form.saldo_apos ? parseFloat(form.saldo_apos) : null,
    });
    setShowForm(false);
    setForm({ data: '', descricao: '', valor: '', categoria: 'recebimento', saldo_apos: '', conta_bancaria: 'NeuralTec 36092-2', detalhe: '', mes_referencia: '' });
    loadData();
  }

  const meses = [...new Set(lancamentos.map(l => l.mes_referencia).filter(Boolean))].sort();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Extrato Bancário" subtitle="NeuralTec · Sicredi Conta 36092-2 · Cooperativa 2604">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={m => { setSelectedMonth(m); }}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Lançamento
        </Button>
      </PageHeader>

      {/* Totais por categoria */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {Object.entries(totais).map(([cat, val]) => (
          <div key={cat} className="bg-card rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{categoriaLabels[cat] || cat}</p>
            <p className={`text-sm font-bold ${val >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(val)}</p>
          </div>
        ))}
        <div className="bg-card rounded-lg border p-3 border-primary/30">
          <p className="text-xs text-muted-foreground font-semibold">Total</p>
          <p className={`text-sm font-bold ${totalGeral >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalGeral)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar descrição..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-[180px]"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {Object.entries(categoriaLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMes} onValueChange={setFilterMes}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Meses</SelectItem>
            {meses.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Data</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descrição</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Categoria</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum lançamento encontrado</td></tr>
              ) : (
                filtered.map(l => (
                  <tr key={l.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(l.data)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{l.descricao}</p>
                      {l.detalhe && <p className="text-xs text-muted-foreground">{l.detalhe}</p>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={l.categoria} /></td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${(l.valor || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(l.valor)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{l.saldo_apos != null ? formatCurrency(l.saldo_apos) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={3} className="px-4 py-3 font-semibold">Total ({filtered.length} lançamentos)</td>
                  <td className={`px-4 py-3 text-right font-bold ${totalGeral >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalGeral)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Lançamento Bancário</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} required /></div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required /></div>
            </div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm({...form, categoria: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoriaLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Mês Referência</Label><Input placeholder="ex: 2025-03" value={form.mes_referencia} onChange={e => setForm({...form, mes_referencia: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Saldo Após</Label><Input type="number" step="0.01" value={form.saldo_apos} onChange={e => setForm({...form, saldo_apos: e.target.value})} /></div>
              <div><Label>Conta Bancária</Label><Input value={form.conta_bancaria} onChange={e => setForm({...form, conta_bancaria: e.target.value})} /></div>
            </div>
            <div><Label>Detalhe</Label><Input value={form.detalhe} onChange={e => setForm({...form, detalhe: e.target.value})} /></div>
            <Button type="submit" className="w-full">Salvar Lançamento</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}