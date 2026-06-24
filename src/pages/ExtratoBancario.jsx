import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Filter, Trash2, UserCheck } from 'lucide-react';
import { deduplicarImportacoes } from '@/functions/deduplicarImportacoes';
import { reclassificarPessoal } from '@/functions/reclassificarPessoal';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator from '../components/shared/MonthNavigator';
import MobileKPICarousel from '../components/shared/MobileKPICarousel';
import MobileFilterDrawer from '../components/shared/MobileFilterDrawer';
import ResponsiveListView from '../components/shared/ResponsiveListView';
import MobileListCard from '../components/shared/MobileListCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency, formatDate, categoriaLabels } from '../lib/formatters';
import { getCurrentMonth } from '../lib/currentMonth';

export default function ExtratoBancario() {
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState('all');
  const [editingCategoria, setEditingCategoria] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isAnnual, setIsAnnual] = useState(false);
  const [deduping, setDeduping] = useState(false);
  const [dedupResult, setDedupResult] = useState(null);
  const [reclassificando, setReclassificando] = useState(false);
  const [reclassResult, setReclassResult] = useState(null);
  const [form, setForm] = useState({
    data: '', descricao: '', valor: '', categoria: 'recebimento',
    saldo_apos: '', conta_bancaria: 'NeuralTec 36092-2', detalhe: '', mes_referencia: ''
  });

  async function loadData() {
    setLoading(true);
    let attempts = 0;
    while (attempts < 3) {
      try {
        const data = await base44.entities.LancamentoBancario.list('-data', 500);
        setLancamentos(data);
        break;
      } catch (e) {
        attempts++;
        const isRateLimit = e?.status === 429 || (e?.message || '').includes('Rate limit');
        if (isRateLimit && attempts < 3) {
          await new Promise(r => setTimeout(r, 1500 * attempts));
        } else {
          break;
        }
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('neuralfinRefresh', handler);
    return () => { window.removeEventListener('neuralfinRefresh', handler); };
  }, []);

  const filtered = useMemo(() => {
    return lancamentos.filter(l => {
      if (!isAnnual) {
        const mes = l.mes_referencia || l.data?.slice(0,7);
        if (mes !== selectedMonth) return false;
      }
      if (filterCategoria !== 'all' && l.categoria !== filterCategoria) return false;
      if (searchTerm && !l.descricao?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [lancamentos, filterCategoria, searchTerm, selectedMonth, isAnnual]);

  const totais = useMemo(() => {
    const cats = {};
    filtered.forEach(l => {
      cats[l.categoria] = (cats[l.categoria] || 0) + (l.valor || 0);
    });
    return cats;
  }, [filtered]);

  const totalGeral = filtered.reduce((s, l) => s + (l.valor || 0), 0);

  async function handleCategoriaChange(id, newCat) {
    await base44.entities.LancamentoBancario.update(id, { categoria: newCat });
    setEditingCategoria(null);
    loadData();
  }

  async function handleReclassificarPessoal() {
    setReclassificando(true);
    setReclassResult(null);
    // Primeiro dry-run para mostrar o que vai mudar
    const preview = await reclassificarPessoal({ dry_run: true });
    const total = preview?.data?.total_encontrados || 0;
    if (total === 0) {
      setReclassResult({ total: 0 });
      setReclassificando(false);
      setTimeout(() => setReclassResult(null), 4000);
      return;
    }
    if (!confirm(`Encontrados ${total} lançamento(s) que parecem ser Pró-labore ou Folha de Pagamento e estão classificados em outra categoria.\n\nReclassificar todos como "Pessoal"?`)) {
      setReclassificando(false);
      return;
    }
    const res = await reclassificarPessoal({});
    setReclassResult({ total: res?.data?.total_reclassificados || 0 });
    setReclassificando(false);
    loadData();
    setTimeout(() => setReclassResult(null), 5000);
  }

  async function handleDedup() {
    if (!confirm('Remover lançamentos duplicados (mesma data + valor + conta)? Esta ação não pode ser desfeita.')) return;
    setDeduping(true);
    setDedupResult(null);
    const res = await deduplicarImportacoes({});
    const removidos = res?.data?.removed?.LancamentoBancario || 0;
    setDedupResult(removidos);
    setDeduping(false);
    loadData();
    setTimeout(() => setDedupResult(null), 5000);
  }

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

  const monthTotals = useMemo(() => {
    const totals = {};
    lancamentos.forEach(l => {
      const m = l.mes_referencia || l.data?.slice(0,7);
      if (m) totals[m] = (totals[m] || 0) + (l.valor || 0);
    });
    return totals;
  }, [lancamentos]);

  const activeFilterCount = (filterCategoria !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0);

  return (
    <div className="p-3 sm:p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Extrato Bancário" subtitle="NeuralTec · Sicredi 36092-2">
        <div className="flex gap-2 flex-wrap w-full md:w-auto">
          <Button onClick={() => setShowForm(true)} className="gap-2 flex-1 md:flex-none" size="sm">
            <Plus className="w-4 h-4" /> Novo
          </Button>
          <Button variant="outline" onClick={handleReclassificarPessoal} disabled={reclassificando} className="gap-2 flex-1 md:flex-none" size="sm" title="Reclassificar Pró-labore e Folha como Pessoal">
            <UserCheck className="w-4 h-4" /> {reclassificando ? '...' : 'Reclassif. Pessoal'}
          </Button>
          <Button variant="outline" onClick={handleDedup} disabled={deduping} className="gap-2 flex-1 md:flex-none" size="sm">
            <Trash2 className="w-4 h-4" /> {deduping ? '...' : 'Deduplicar'}
          </Button>
        </div>
      </PageHeader>

      {/* Month navigator — separado em linha própria no mobile */}
      <div className="mb-4 -mx-1 overflow-x-auto">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={m => { setSelectedMonth(m); }}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
      </div>

      {dedupResult !== null && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold ${dedupResult > 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
          {dedupResult > 0 ? `✓ ${dedupResult} duplicata(s) removida(s)` : '✓ Banco já está limpo'}
        </div>
      )}

      {reclassResult !== null && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold ${reclassResult.total > 0 ? 'bg-violet-50 text-violet-800 border border-violet-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
          {reclassResult.total > 0 ? `✓ ${reclassResult.total} lançamento(s) reclassificado(s) como Pessoal (Pró-labore / Folha)` : '✓ Nenhum lançamento pendente — classificações de Pessoal estão corretas'}
        </div>
      )}

      {/* KPIs por categoria — carrossel no mobile, grid no desktop */}
      <MobileKPICarousel desktopGridClass="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(totais).map(([cat, val]) => {
          const isActive = filterCategoria === cat;
          return (
            <GradientCard
              key={cat}
              title={categoriaLabels[cat] || cat}
              value={formatCurrency(val)}
              gradient={val >= 0 ? 'green' : 'red'}
              active={isActive}
              onClick={() => setFilterCategoria(isActive ? 'all' : cat)}
            />
          );
        })}
        <GradientCard
          title="Total"
          value={formatCurrency(totalGeral)}
          gradient={totalGeral >= 0 ? 'blue' : 'red'}
          active={filterCategoria === 'all'}
          onClick={() => setFilterCategoria('all')}
        />
      </MobileKPICarousel>

      {/* Filtros — busca sempre visível, categoria no drawer no mobile */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar descrição..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="md:hidden shrink-0 w-32">
          <MobileFilterDrawer activeCount={filterCategoria !== 'all' ? 1 : 0}>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Categoria</Label>
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {Object.entries(categoriaLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </MobileFilterDrawer>
        </div>
        <div className="hidden md:block">
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-[180px]"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {Object.entries(categoriaLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Listagem responsiva */}
      <ResponsiveListView
        items={filtered}
        loading={loading}
        emptyMessage="Nenhum lançamento encontrado"
        mobileRender={(l) => (
          <MobileListCard
            topLeft={formatDate(l.data)}
            topRight={formatCurrency(l.valor)}
            topRightClass={(l.valor || 0) >= 0 ? 'text-green-600' : 'text-red-600'}
            title={l.descricao}
            subtitle={l.detalhe}
            meta={l.saldo_apos != null ? `Saldo: ${formatCurrency(l.saldo_apos)}` : null}
            badge={
              <button
                onClick={e => { e.stopPropagation(); setEditingCategoria(editingCategoria === l.id ? null : l.id); }}
                className="hover:opacity-70 transition-opacity"
              >
                {editingCategoria === l.id ? (
                  <select
                    autoFocus
                    defaultValue={l.categoria}
                    onClick={e => e.stopPropagation()}
                    onBlur={e => handleCategoriaChange(l.id, e.target.value)}
                    onChange={e => handleCategoriaChange(l.id, e.target.value)}
                    className="text-xs border rounded px-2 py-1 bg-background"
                  >
                    {Object.entries(categoriaLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <StatusBadge status={l.categoria} />
                )}
              </button>
            }
          />
        )}
        mobileFooter={
          filtered.length > 0 && (
            <div className="bg-card border rounded-xl p-3 mt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Total ({filtered.length})</span>
                <span className={`font-bold tabular-nums ${totalGeral >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalGeral)}</span>
              </div>
            </div>
          )
        }
        desktop={
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
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
                    <td className="px-4 py-3">
                      {editingCategoria === l.id ? (
                        <select
                          autoFocus
                          defaultValue={l.categoria}
                          onBlur={e => handleCategoriaChange(l.id, e.target.value)}
                          onChange={e => handleCategoriaChange(l.id, e.target.value)}
                          className="text-xs border rounded px-2 py-1 bg-background"
                        >
                          {Object.entries(categoriaLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setEditingCategoria(l.id); }}
                          title="Clique para editar"
                          className="hover:opacity-70 transition-opacity"
                        >
                          <StatusBadge status={l.categoria} />
                        </button>
                      )}
                    </td>
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
        }
      />

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Lançamento Bancário</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} required /></div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required /></div>
            </div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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