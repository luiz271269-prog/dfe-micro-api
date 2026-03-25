import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../lib/formatters';

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
  const [searchTerm, setSearchTerm] = useState('');
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

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    return titulos.filter(t => {
      if (quickFilter === 'pagos' && t.status !== 'pago') return false;
      if (quickFilter === 'abertos' && t.status !== 'em_aberto') return false;
      if (quickFilter === 'vencidos' && t.status !== 'vencido') return false;
      if (searchTerm && !t.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) && !t.nosso_numero?.includes(searchTerm)) return false;
      return true;
    });
  }, [titulos, quickFilter, searchTerm]);

  const totalEmitido = filtered.reduce((s, t) => s + (t.valor_titulo || 0), 0);
  const totalPago = filtered.filter(t => t.status === 'pago').reduce((s, t) => s + (t.valor_pago || 0), 0);
  const totalAberto = filtered.filter(t => t.status !== 'pago').reduce((s, t) => s + (t.valor_titulo || 0), 0);

  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const alertas = titulos.filter(t => {
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

  const countByStatus = { todos: titulos.length, pagos: titulos.filter(t => t.status === 'pago').length, abertos: titulos.filter(t => t.status === 'em_aberto').length, vencidos: titulos.filter(t => t.status === 'vencido').length };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Cobranças Sicredi" subtitle="Gestão de títulos e boletos">
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo Título</Button>
      </PageHeader>

      {/* Alerta */}
      {alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Vencimentos nos próximos 7 dias ({alertas.length})</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {alertas.map(a => (
                <span key={a.id} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{a.cliente} — {formatCurrency(a.valor_titulo)} — {formatDate(a.data_vencimento)}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl border p-4"><p className="text-xs text-muted-foreground">Total Emitido</p><p className="text-xl font-bold text-blue-600">{formatCurrency(totalEmitido)}</p></div>
        <div className="bg-card rounded-xl border p-4"><p className="text-xs text-muted-foreground">Pago</p><p className="text-xl font-bold text-green-600">{formatCurrency(totalPago)}</p><p className="text-xs text-muted-foreground">{totalEmitido > 0 ? ((totalPago / totalEmitido) * 100).toFixed(1) : 0}%</p></div>
        <div className="bg-card rounded-xl border p-4"><p className="text-xs text-muted-foreground">Em Aberto</p><p className="text-xl font-bold text-orange-600">{formatCurrency(totalAberto)}</p></div>
      </div>

      {/* Quick filters + search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex rounded-lg border overflow-hidden">
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'abertos', label: 'Em Aberto' },
            { key: 'vencidos', label: 'Vencidos' },
            { key: 'pagos', label: 'Pagos' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setQuickFilter(f.key)}
              className={`px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 ${quickFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
            >
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${quickFilter === f.key ? 'bg-white/20' : 'bg-muted'}`}>{countByStatus[f.key]}</span>
            </button>
          ))}
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
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nosso Nº</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vencimento</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Parcela</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Pago</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhum título encontrado</td></tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id} className={`border-b transition-colors ${statusRowColors[t.status] || ''} hover:brightness-95`}>
                    <td className="px-4 py-3 font-medium">{t.nosso_numero}</td>
                    <td className="px-4 py-3">{t.cliente}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.data_vencimento)}</td>
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
                ))
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