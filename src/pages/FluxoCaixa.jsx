import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, AlertTriangle, TrendingDown, TrendingUp, BarChart3, Landmark, DollarSign } from 'lucide-react';
import { GradientCard } from '../components/shared/GradientCard';
import MonthNavigator, { ALL_MONTHS } from '../components/shared/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../lib/formatters';

const CATEGORIAS = ['recebimento_vendas', 'recebimento_cobranca', 'pagamento_fornecedor', 'pagamento_tributo', 'folha_pagamento', 'aluguel', 'despesa_fixa', 'despesa_variavel', 'investimento', 'emprestimo', 'outro'];

export default function FluxoCaixa() {
  const [fluxos, setFluxos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-03');
  const [isAnnual, setIsAnnual] = useState(false);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [form, setForm] = useState({
    data_prevista: '', tipo: '', categoria: '', descricao: '', valor_previsto: '', valor_realizado: '0',
    status: 'previsto', recorrente: false, frequencia: 'unico', conta_bancaria: '', origem_id: '', origem_tipo: 'manual'
  });

  async function loadData() {
    const data = await base44.entities.FluxoCaixa.list('-data_prevista', 500);
    setFluxos(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await base44.entities.FluxoCaixa.create({
      ...form,
      valor_previsto: parseFloat(form.valor_previsto),
      valor_realizado: parseFloat(form.valor_realizado) || 0,
      recorrente: form.recorrente,
    });
    setForm({ data_prevista: '', tipo: '', categoria: '', descricao: '', valor_previsto: '', valor_realizado: '0', status: 'previsto', recorrente: false, frequencia: 'unico', conta_bancaria: '', origem_id: '', origem_tipo: 'manual' });
    setShowForm(false);
    loadData();
  }

  async function markRealizado(id, valor) {
    await base44.entities.FluxoCaixa.update(id, { status: 'realizado', valor_realizado: valor });
    loadData();
  }

  const monthTotals = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach(m => {
      t[m] = fluxos.filter(f => f.data_prevista?.startsWith(m) && f.tipo === 'entrada').reduce((s,f) => s+(f.valor_previsto||0), 0);
    });
    return t;
  }, [fluxos]);

  const filtrados = fluxos.filter(f => {
    if (!isAnnual && !f.data_prevista?.startsWith(selectedMonth)) return false;
    if (filterTipo && f.tipo !== filterTipo) return false;
    if (filterStatus && f.status !== filterStatus) return false;
    if (filterCategoria && f.categoria !== filterCategoria) return false;
    return true;
  });

  // Próximos 30 dias
  const today = new Date();
  const next30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const proximosMes = fluxos.filter(f => {
    const d = new Date(f.data_prevista);
    return d >= today && d <= next30 && f.status !== 'cancelado';
  });

  // Agrupar por semana
  const porSemana = {};
  proximosMes.forEach(f => {
    const d = new Date(f.data_prevista);
    const sem = Math.floor((d.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const key = `Sem ${sem}`;
    if (!porSemana[key]) porSemana[key] = { semana: key, entradas: 0, saidas: 0 };
    if (f.tipo === 'entrada') porSemana[key].entradas += f.valor_previsto;
    else porSemana[key].saidas += f.valor_previsto;
  });

  const chartData = Object.values(porSemana);

  // Saldo projetado
  const entradasTotal = proximosMes.filter(f => f.tipo === 'entrada').reduce((s, f) => s + f.valor_previsto, 0);
  const saidasTotal = proximosMes.filter(f => f.tipo === 'saida').reduce((s, f) => s + f.valor_previsto, 0);
  const saldoProjetado = 54187.06 + entradasTotal - saidasTotal;
  const alertaNegativo = saldoProjetado < 0;

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Fluxo de Caixa" subtitle="Projeção dos próximos 30 dias">
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Movimentação</Button>
      </PageHeader>

      {alertaNegativo && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Atenção: Saldo Projetado Negativo</p>
            <p className="text-xs text-red-600 mt-1">Seu saldo projetado em 30 dias será {formatCurrency(saldoProjetado)}. Verifique entradas e saídas.</p>
          </div>
        </div>
      )}

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <GradientCard title="Entradas" value={formatCurrency(entradasTotal)} sub="próx. 30 dias" icon={TrendingUp} gradient="green" />
        <GradientCard title="Saídas" value={formatCurrency(saidasTotal)} sub="próx. 30 dias" icon={TrendingDown} gradient="red" />
        <GradientCard title="Saldo Atual" value="R$ 54.187,06" sub="NeuralTec 36092-2" icon={Landmark} gradient="blue" />
        <GradientCard title="Saldo Projetado" value={formatCurrency(saldoProjetado)} sub="em 30 dias" icon={BarChart3} gradient={alertaNegativo ? 'red' : 'teal'} />
      </div>

      {/* Gráficos */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-card rounded-xl border p-4">
            <p className="text-sm font-semibold mb-4">Entradas vs Saídas por Semana</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semana" />
                <YAxis />
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend />
                <Bar dataKey="entradas" fill="#22c55e" name="Entradas" />
                <Bar dataKey="saidas" fill="#ef4444" name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-card rounded-xl border p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="entrada">Entrada</SelectItem>
            <SelectItem value="saida">Saída</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="previsto">Previsto</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="realizado">Realizado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="bg-gradient-to-r from-muted/60 to-muted/30">
                <th className="text-left px-4 py-3 font-semibold">Data</th>
                <th className="text-left px-4 py-3 font-semibold">Descrição</th>
                <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold">Categoria</th>
                <th className="text-right px-4 py-3 font-semibold">Valor</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">Nenhuma movimentação encontrada</td></tr>
              ) : (
                filtrados.map(f => (
                  <tr key={f.id} className="border-b">
                    <td className="px-4 py-3 font-semibold">{formatDate(f.data_prevista)}</td>
                    <td className="px-4 py-3">{f.descricao}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${f.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {f.tipo === 'entrada' ? '↓ Entrada' : '↑ Saída'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{f.categoria}</td>
                    <td className={`px-4 py-3 text-right font-bold ${f.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {f.tipo === 'entrada' ? '+' : '-'}{formatCurrency(f.valor_previsto)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                    <td className="px-4 py-3">
                      {f.status === 'previsto' && (
                        <button onClick={() => markRealizado(f.id, f.valor_previsto)} className="text-xs text-primary hover:underline">
                          Marcar realizado
                        </button>
                      )}
                    </td>
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
          <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.data_prevista} onChange={e => setForm({...form, data_prevista: e.target.value})} required /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm({...form, categoria: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor</Label><Input type="number" step="0.01" value={form.valor_previsto} onChange={e => setForm({...form, valor_previsto: e.target.value})} required /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="previsto">Previsto</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full">Salvar Movimentação</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}