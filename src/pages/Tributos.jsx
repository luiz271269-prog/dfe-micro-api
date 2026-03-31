import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, AlertTriangle, Calendar, AlertCircle, DollarSign, CheckCircle } from 'lucide-react';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator, { ALL_MONTHS } from '../components/shared/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../lib/formatters';

const TIPOS = ['DAS', 'ICMS', 'ISS', 'PIS', 'COFINS', 'IRPJ', 'CSLL', 'INSS', 'FGTS', 'GPS', 'DARF', 'IPTU', 'ALVARA', 'TAXA_BOMBEIRO', 'OUTRO'];
const EMPRESAS = ['NeuralTec', 'Liesch'];

export default function Tributos() {
  const [tributos, setTributos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-03');
  const [isAnnual, setIsAnnual] = useState(false);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterMes, setFilterMes] = useState('');
  const [form, setForm] = useState({
    tipo: '', descricao: '', competencia: '', data_vencimento: '',
    valor_original: '', status: 'a_vencer', empresa: '', data_pagamento: '',
    valor_pago: '0', juros_multa: '0'
  });

  async function loadData() {
    const data = await base44.entities.Tributo.list('-data_vencimento', 500);
    setTributos(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await base44.entities.Tributo.create({
      ...form,
      valor_original: parseFloat(form.valor_original),
      valor_pago: parseFloat(form.valor_pago) || 0,
      juros_multa: parseFloat(form.juros_multa) || 0,
    });
    setForm({ tipo: '', descricao: '', competencia: '', data_vencimento: '', valor_original: '', status: 'a_vencer', empresa: '', data_pagamento: '', valor_pago: '0', juros_multa: '0' });
    setShowForm(false);
    loadData();
  }

  const monthTotals = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach(m => {
      t[m] = tributos.filter(tr => tr.data_vencimento?.startsWith(m)).reduce((s,tr) => s+(tr.valor_original||0), 0);
    });
    return t;
  }, [tributos]);

  const filtrados = tributos.filter(t => {
    if (!isAnnual && !t.data_vencimento?.startsWith(selectedMonth)) return false;
    if (filterTipo && t.tipo !== filterTipo) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterEmpresa && t.empresa !== filterEmpresa) return false;
    if (filterMes && t.competencia !== filterMes) return false;
    return true;
  });

  const totalAPagar = filtrados.filter(t => t.status === 'a_vencer' || t.status === 'vencido').reduce((s, t) => s + (t.valor_original || 0), 0);
  const totalPago = filtrados.filter(t => t.status === 'pago').reduce((s, t) => s + (t.valor_pago || 0), 0);
  const vencidos = filtrados.filter(t => t.status === 'vencido').length;
  const dasVencidos = tributos.filter(t => t.tipo === 'DAS' && t.status === 'vencido');

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Gestão de Tributos" subtitle={`${tributos.length} tributos cadastrados`}>
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo Tributo</Button>
      </PageHeader>

      {dasVencidos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Tributos Vencidos - Ação Imediata</p>
            <p className="text-xs text-red-600 mt-1">Você tem {dasVencidos.length} tributo(s) vencido(s). Regularize imediatamente para evitar juros e multa.</p>
          </div>
        </div>
      )}

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <GradientCard
          title="A Pagar"
          value={formatCurrency(totalAPagar)}
          sub={`${filtrados.filter(t=>t.status!=='pago').length} itens pendentes`}
          icon={AlertTriangle}
          gradient="red"
        />
        <GradientCard
          title="Pago no Mês"
          value={formatCurrency(totalPago)}
          sub={`${filtrados.filter(t=>t.status==='pago').length} itens quitados`}
          icon={CheckCircle}
          gradient="green"
        />
        <GradientCard
          title="Vencidos"
          value={vencidos}
          sub={vencidos > 0 ? '⚠ Regularize imediatamente' : 'Tudo em dia'}
          icon={AlertCircle}
          gradient={vencidos > 0 ? 'red' : 'teal'}
        />
      </div>

      {/* Filtros */
      <div className="bg-card rounded-xl border p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="a_vencer">A Vencer</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="parcelado">Parcelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="month" value={filterMes} onChange={e => setFilterMes(e.target.value)} placeholder="Competência" className="h-8 text-sm" />
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="bg-gradient-to-r from-muted/60 to-muted/30">
                <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold">Descrição</th>
                <th className="text-left px-4 py-3 font-semibold">Competência</th>
                <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                <th className="text-left px-4 py-3 font-semibold">Empresa</th>
                <th className="text-right px-4 py-3 font-semibold">Valor</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">Nenhum tributo encontrado</td></tr>
              ) : (
                filtrados.map(t => (
                  <tr key={t.id} className={`border-b ${t.status === 'vencido' ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-semibold">{t.tipo}</td>
                    <td className="px-4 py-3">{t.descricao || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{t.competencia}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(t.data_vencimento)}</td>
                    <td className="px-4 py-3 text-xs">{t.empresa}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(t.valor_original)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Tributo</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={form.empresa} onValueChange={v => setForm({...form, empresa: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Competência</Label><Input type="month" value={form.competencia} onChange={e => setForm({...form, competencia: e.target.value})} required /></div>
              <div><Label>Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm({...form, data_vencimento: e.target.value})} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Valor</Label><Input type="number" step="0.01" value={form.valor_original} onChange={e => setForm({...form, valor_original: e.target.value})} required /></div>
              <div><Label>Juros/Multa</Label><Input type="number" step="0.01" value={form.juros_multa} onChange={e => setForm({...form, juros_multa: e.target.value})} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_vencer">A Vencer</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full">Salvar Tributo</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}