import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, FileText, TrendingUp, DollarSign } from 'lucide-react';
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
import ConciliacaoRelatorio from '../components/faturamento/ConciliacaoRelatorio';

export default function Faturamento() {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detalhes, setDetalhes] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('2026-04');
  const [isAnnual, setIsAnnual] = useState(false);
  const [filterVendedor, setFilterVendedor] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    numero: '', tipo: 'NF', data_emissao: '', cliente: '', vendedor: 'Tiago',
    valor_total: '', valor_recebido: '0', valor_aberto: '', status: 'a_vencer',
    canal_cobranca: 'sicredi', data_vencimento_proxima: ''
  });

  async function loadData() {
    setLoading(true);
    const data = await base44.entities.NotaFiscal.list('-data_emissao', 500);
    setNotas(data);
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
      t[m] = notas.filter(n => n.data_emissao?.startsWith(m)).reduce((s,n) => s+(n.valor_total||0), 0);
    });
    return t;
  }, [notas]);

  const filtered = useMemo(() => {
    return notas.filter(n => {
      if (!isAnnual && !n.data_emissao?.startsWith(selectedMonth)) return false;
      if (filterVendedor !== 'all' && n.vendedor !== filterVendedor) return false;
      if (filterTipo !== 'all' && n.tipo !== filterTipo) return false;
      if (filterStatus !== 'all' && n.status !== filterStatus) return false;
      if (searchTerm && !n.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) && !n.numero?.includes(searchTerm)) return false;
      return true;
    });
  }, [notas, filterVendedor, filterTipo, filterStatus, searchTerm, selectedMonth, isAnnual]);

  const totalFaturado = filtered.reduce((s, n) => s + (n.valor_total || 0), 0);
  const totalRecebido = filtered.reduce((s, n) => s + (n.valor_recebido || 0), 0);
  const totalAberto = filtered.reduce((s, n) => s + (n.valor_aberto || 0), 0);

  // Por vendedor — respeita filtro de mês/anual
  const tiagototal = filtered.filter(n => n.vendedor === 'Tiago').reduce((s, n) => s + (n.valor_total || 0), 0);
  const tiagoAberto = filtered.filter(n => n.vendedor === 'Tiago').reduce((s, n) => s + (n.valor_aberto || 0), 0);
  const tiagoRecebido = filtered.filter(n => n.vendedor === 'Tiago').reduce((s, n) => s + (n.valor_recebido || 0), 0);
  const thaisTotal = filtered.filter(n => n.vendedor === 'Thais').reduce((s, n) => s + (n.valor_total || 0), 0);
  const thaisAberto = filtered.filter(n => n.vendedor === 'Thais').reduce((s, n) => s + (n.valor_aberto || 0), 0);
  const thaisRecebido = filtered.filter(n => n.vendedor === 'Thais').reduce((s, n) => s + (n.valor_recebido || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    const valorTotal = parseFloat(form.valor_total);
    const valorRecebido = parseFloat(form.valor_recebido) || 0;
    await base44.entities.NotaFiscal.create({
      ...form,
      valor_total: valorTotal,
      valor_recebido: valorRecebido,
      valor_aberto: valorTotal - valorRecebido,
    });
    setShowForm(false);
    setForm({ numero: '', tipo: 'NF', data_emissao: '', cliente: '', vendedor: 'Tiago', valor_total: '', valor_recebido: '0', valor_aberto: '', status: 'a_vencer', canal_cobranca: 'sicredi', data_vencimento_proxima: '' });
    loadData();
  }

  async function darBaixa(nf) {
    const novoRecebido = nf.valor_total;
    await base44.entities.NotaFiscal.update(nf.id, {
      valor_recebido: novoRecebido,
      valor_aberto: 0,
      status: 'pago',
    });
    setDetalhes(null);
    loadData();
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Faturamento" subtitle="Notas Fiscais e Contratos de Intermediação">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova NF</Button>
      </PageHeader>

      {/* Conciliação NFs × Relatório */}
      <ConciliacaoRelatorio selectedMonth={selectedMonth} nfsMes={notas.filter(n => n.data_emissao?.startsWith(selectedMonth))} />

      {/* Cards por vendedor */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <GradientCard
          title="Tiago (V-01)"
          value={formatCurrency(tiagototal)}
          sub={`✓ ${formatCurrency(tiagoRecebido)} · ⏳ ${formatCurrency(tiagoAberto)} · ${filtered.filter(n=>n.vendedor==='Tiago').length} NFs`}
          icon={FileText}
          gradient="blue"
          active={filterVendedor === 'Tiago'}
          onClick={() => setFilterVendedor(filterVendedor === 'Tiago' ? 'all' : 'Tiago')}
        />
        <GradientCard
          title="Thais (V-05)"
          value={formatCurrency(thaisTotal)}
          sub={`✓ ${formatCurrency(thaisRecebido)} · ⏳ ${formatCurrency(thaisAberto)} · ${filtered.filter(n=>n.vendedor==='Thais').length} NFs`}
          icon={FileText}
          gradient="purple"
          active={filterVendedor === 'Thais'}
          onClick={() => setFilterVendedor(filterVendedor === 'Thais' ? 'all' : 'Thais')}
        />
        <GradientCard
          title="Total Geral"
          value={formatCurrency(totalFaturado)}
          sub={`✓ ${formatCurrency(totalRecebido)} · ⏳ ${formatCurrency(totalAberto)} · ${filtered.length} NFs`}
          icon={TrendingUp}
          gradient="green"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente ou NF..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterVendedor} onValueChange={setFilterVendedor}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Tiago">Tiago</SelectItem>
            <SelectItem value="Thais">Thais</SelectItem>
            <SelectItem value="Fat.Direto">Fat. Direto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[110px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="NF">NF</SelectItem>
            <SelectItem value="CI">CI</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="a_vencer">A Vencer</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">NF/CI</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 font-semibold text-muted-foreground">Vendedor</th>
                <th className="hidden md:table-cell text-left px-4 py-3 font-semibold text-muted-foreground">Emissão</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total</th>
                <th className="hidden sm:table-cell text-right px-4 py-3 font-semibold text-muted-foreground">Recebido</th>
                <th className="hidden sm:table-cell text-right px-4 py-3 font-semibold text-muted-foreground">Aberto</th>
                <th className="hidden lg:table-cell text-left px-4 py-3 font-semibold text-muted-foreground">Próx. Venc.</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nenhuma nota encontrada</td></tr>
              ) : (
                filtered.map(n => (
                  <tr key={n.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetalhes(n)}>
                    <td className="px-4 py-3 font-medium">{n.numero} <span className="text-xs text-muted-foreground">({n.tipo})</span></td>
                      <td className="px-4 py-3">{n.cliente}</td>
                      <td className="hidden sm:table-cell px-4 py-3">
                       <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${n.vendedor === 'Tiago' ? 'bg-blue-100 text-blue-700' : n.vendedor === 'Thais' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                         {n.vendedor}
                       </span>
                     </td>
                      <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">{formatDate(n.data_emissao)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(n.valor_total)}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums text-green-600">{formatCurrency(n.valor_recebido)}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums text-orange-600">{formatCurrency(n.valor_aberto)}</td>
                      <td className="hidden lg:table-cell px-4 py-3 whitespace-nowrap text-sm">{formatDate(n.data_vencimento_proxima)}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={n.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={4} className="px-4 py-3 font-semibold">Total ({filtered.length} notas)</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(totalFaturado)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(totalRecebido)}</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-600">{formatCurrency(totalAberto)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Detalhes/Baixa modal */}
      {detalhes && (
        <Dialog open={!!detalhes} onOpenChange={open => { if (!open) setDetalhes(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>NF {detalhes.numero} — {detalhes.cliente}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium">{detalhes.tipo}</p></div>
                <div><p className="text-xs text-muted-foreground">Vendedor</p><p className="font-medium">{detalhes.vendedor}</p></div>
                <div><p className="text-xs text-muted-foreground">Emissão</p><p className="font-medium">{formatDate(detalhes.data_emissao)}</p></div>
                <div><p className="text-xs text-muted-foreground">Próx. Vencimento</p><p className="font-medium">{formatDate(detalhes.data_vencimento_proxima)}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor Total</p><p className="font-bold text-lg">{formatCurrency(detalhes.valor_total)}</p></div>
                <div><p className="text-xs text-muted-foreground">Canal Cobrança</p><p className="font-medium">{detalhes.canal_cobranca}</p></div>
              </div>
              <div className="flex gap-3 pt-2">
                <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Recebido</p>
                  <p className="font-bold text-green-700">{formatCurrency(detalhes.valor_recebido)}</p>
                </div>
                <div className="flex-1 bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Em Aberto</p>
                  <p className="font-bold text-orange-700">{formatCurrency(detalhes.valor_aberto)}</p>
                </div>
              </div>
              <StatusBadge status={detalhes.status} />
              {detalhes.status !== 'pago' && (
                <Button className="w-full" onClick={() => darBaixa(detalhes)}>
                  Dar Baixa — Marcar como Pago
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Nota Fiscal</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Número</Label><Input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} required /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="NF">NF</SelectItem><SelectItem value="CI">CI</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Emissão</Label><Input type="date" value={form.data_emissao} onChange={e => setForm({...form, data_emissao: e.target.value})} required /></div>
            </div>
            <div><Label>Cliente</Label><Input value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendedor</Label>
                <Select value={form.vendedor} onValueChange={v => setForm({...form, vendedor: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tiago">Tiago</SelectItem>
                    <SelectItem value="Thais">Thais</SelectItem>
                    <SelectItem value="Fat.Direto">Fat. Direto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="a_vencer">A Vencer</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor Total</Label><Input type="number" step="0.01" value={form.valor_total} onChange={e => setForm({...form, valor_total: e.target.value})} required /></div>
              <div><Label>Valor Recebido</Label><Input type="number" step="0.01" value={form.valor_recebido} onChange={e => setForm({...form, valor_recebido: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Canal Cobrança</Label>
                <Select value={form.canal_cobranca} onValueChange={v => setForm({...form, canal_cobranca: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sicredi">Sicredi</SelectItem>
                    <SelectItem value="magalu">Magalu</SelectItem>
                    <SelectItem value="carteira">Carteira</SelectItem>
                    <SelectItem value="fat_direto">Fat. Direto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Próx. Vencimento</Label><Input type="date" value={form.data_vencimento_proxima} onChange={e => setForm({...form, data_vencimento_proxima: e.target.value})} /></div>
            </div>
            <Button type="submit" className="w-full">Salvar Nota Fiscal</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}