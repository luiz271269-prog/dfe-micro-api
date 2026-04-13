import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, ShoppingCart, TrendingDown, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator, { ALL_MONTHS } from '../components/shared/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency, formatDate } from '../lib/formatters';

const fornecedorOptions = ['COMPRAS A VISTA', 'MERCADO LIVRE', 'PAUTA DISTRIBUIÇÃO'];
const categoriaOptions = ['notebook', 'tablet', 'smartphone', 'componente', 'memoria', 'armazenamento', 'periferico', 'software', 'rede', 'outro'];
const categoriaColors = {
  notebook: 'bg-blue-100 text-blue-700', tablet: 'bg-purple-100 text-purple-700',
  smartphone: 'bg-green-100 text-green-700', componente: 'bg-orange-100 text-orange-700',
  memoria: 'bg-yellow-100 text-yellow-700', armazenamento: 'bg-cyan-100 text-cyan-700',
  periferico: 'bg-pink-100 text-pink-700', software: 'bg-indigo-100 text-indigo-700',
  rede: 'bg-teal-100 text-teal-700', outro: 'bg-slate-100 text-slate-700',
};

export default function Compras() {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-04');
  const [isAnnual, setIsAnnual] = useState(false);
  const [filterFornecedor, setFilterFornecedor] = useState('all');
  const [filterCategoria, setFilterCategoria] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [fornecedores, setFornecedores] = useState([]);
  const [fornInput, setFornInput] = useState('COMPRAS A VISTA');
  const [showFornSugg, setShowFornSugg] = useState(false);
  const [form, setForm] = useState({
    fornecedor: 'COMPRAS A VISTA', numero_nota: '', data_emissao: '',
    descricao_produto: '', categoria_produto: 'notebook', quantidade: '1',
    valor_unitario: '', valor_total: '', codigo_produto: ''
  });

  async function loadData() {
    setLoading(true);
    const [data, forns] = await Promise.all([
      base44.entities.ItemCompra.list('-data_emissao', 500),
      base44.entities.Fornecedor.list('nome', 200),
    ]);
    setCompras(data);
    setFornecedores(forns);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('neuralfinRefresh', handler);
    const unsub = base44.entities.ItemCompra.subscribe(() => loadData());
    return () => { window.removeEventListener('neuralfinRefresh', handler); unsub(); };
  }, []);

  const fornSuggestions = useMemo(() => {
    const todos = [
      ...fornecedores.map(f => f.nome),
      ...fornecedorOptions.filter(f => !fornecedores.some(fdb => fdb.nome === f))
    ];
    if (!fornInput) return todos;
    return todos.filter(f => f.toLowerCase().includes(fornInput.toLowerCase()));
  }, [fornecedores, fornInput]);

  const monthTotals = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach(m => {
      t[m] = compras.filter(c => c.data_emissao?.startsWith(m)).reduce((s,c) => s+(c.valor_total||0), 0);
    });
    return t;
  }, [compras]);

  const filtered = useMemo(() => {
    return compras.filter(c => {
      if (!isAnnual && !c.data_emissao?.startsWith(selectedMonth)) return false;
      if (filterFornecedor !== 'all' && c.fornecedor !== filterFornecedor) return false;
      if (filterCategoria !== 'all' && c.categoria_produto !== filterCategoria) return false;
      if (searchTerm && !c.descricao_produto?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [compras, filterFornecedor, filterCategoria, searchTerm, selectedMonth, isAnnual]);

  const totalGeral = filtered.reduce((s, c) => s + (c.valor_total || 0), 0);

  // Compras filtradas apenas por mês (sem filtros de fornecedor/categoria/busca) para os cards
  const comprasMes = useMemo(() => {
    if (isAnnual) return compras;
    return compras.filter(c => c.data_emissao?.startsWith(selectedMonth));
  }, [compras, selectedMonth, isAnnual]);

  const totaisFornecedor = useMemo(() => {
    const t = {};
    comprasMes.forEach(c => { t[c.fornecedor] = (t[c.fornecedor] || 0) + (c.valor_total || 0); });
    return t;
  }, [comprasMes]);
  const grandTotal = comprasMes.reduce((s, c) => s + (c.valor_total || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    await base44.entities.ItemCompra.create({
      ...form,
      fornecedor: fornInput || form.fornecedor,
      quantidade: parseInt(form.quantidade) || 1,
      valor_unitario: form.valor_unitario ? parseFloat(form.valor_unitario) : null,
      valor_total: parseFloat(form.valor_total),
    });
    setShowForm(false);
    setFornInput('COMPRAS A VISTA');
    setForm({ fornecedor: 'COMPRAS A VISTA', numero_nota: '', data_emissao: '', descricao_produto: '', categoria_produto: 'notebook', quantidade: '1', valor_unitario: '', valor_total: '', codigo_produto: '' });
    loadData();
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Compras" subtitle="Gestão de aquisições de produtos">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
        <Link to="/produtos?tab=fornecedores">
          <Button variant="outline" className="gap-2"><Building2 className="w-4 h-4" /> Fornecedores</Button>
        </Link>
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Compra</Button>
      </PageHeader>

      {/* Cards por fornecedor */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {fornecedorOptions.map((f, i) => {
          const val = totaisFornecedor[f] || 0;
          const perc = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(0) : 0;
          const isActive = filterFornecedor === f;
          const grads = ['orange', 'blue', 'purple'];
          return (
            <GradientCard
              key={f}
              title={f}
              value={formatCurrency(val)}
              sub={`${perc}% do total`}
              icon={ShoppingCart}
              gradient={grads[i] || 'slate'}
              active={isActive}
              onClick={() => setFilterFornecedor(isActive ? 'all' : f)}
            />
          );
        })}
        <GradientCard
          title="Total Compras"
          value={formatCurrency(grandTotal)}
          sub={`${compras.length} itens`}
          icon={TrendingDown}
          gradient="red"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterFornecedor} onValueChange={setFilterFornecedor}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {fornecedorOptions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categoriaOptions.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Data</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Produto</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Fornecedor</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Categoria</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Qtd</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Unit.</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Nenhuma compra encontrada</td></tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.data_emissao)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.descricao_produto}</p>
                      {c.numero_nota && <p className="text-xs text-muted-foreground">NF {c.numero_nota}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs">{c.fornecedor}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoriaColors[c.categoria_produto] || 'bg-slate-100 text-slate-700'}`}>
                        {c.categoria_produto}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.quantidade}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.valor_unitario ? formatCurrency(c.valor_unitario) : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600">{formatCurrency(c.valor_total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={6} className="px-4 py-3 font-semibold">Total ({filtered.length} itens)</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(totalGeral)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Compra</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <Label>Fornecedor</Label>
                <Input
                  value={fornInput}
                  onChange={e => { setFornInput(e.target.value); setShowFornSugg(true); }}
                  onFocus={() => setShowFornSugg(true)}
                  onBlur={() => setTimeout(() => setShowFornSugg(false), 150)}
                  placeholder="Digite ou selecione..."
                />
                {showFornSugg && fornSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-popover border rounded-md shadow-md mt-1 max-h-40 overflow-y-auto">
                    {fornSuggestions.map(f => (
                      <div key={f} className="px-3 py-2 text-sm cursor-pointer hover:bg-accent" onMouseDown={() => { setFornInput(f); setShowFornSugg(false); }}>{f}</div>
                    ))}
                  </div>
                )}
              </div>
              <div><Label>Data Emissão</Label><Input type="date" value={form.data_emissao} onChange={e => setForm({...form, data_emissao: e.target.value})} required /></div>
            </div>
            <div><Label>Descrição do Produto</Label><Input value={form.descricao_produto} onChange={e => setForm({...form, descricao_produto: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria_produto} onValueChange={v => setForm({...form, categoria_produto: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categoriaOptions.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nº Nota</Label><Input value={form.numero_nota} onChange={e => setForm({...form, numero_nota: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Código do Produto</Label><Input value={form.codigo_produto} onChange={e => setForm({...form, codigo_produto: e.target.value})} placeholder="Opcional" /></div>
              <div></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Quantidade</Label><Input type="number" value={form.quantidade} onChange={e => setForm({...form, quantidade: e.target.value})} /></div>
              <div><Label>Valor Unit.</Label><Input type="number" step="0.01" value={form.valor_unitario} onChange={e => setForm({...form, valor_unitario: e.target.value})} /></div>
              <div><Label>Valor Total</Label><Input type="number" step="0.01" value={form.valor_total} onChange={e => setForm({...form, valor_total: e.target.value})} required /></div>
            </div>
            <Button type="submit" className="w-full">Salvar Compra</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}