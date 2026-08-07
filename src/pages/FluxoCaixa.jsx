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
import { formatCurrency } from '../lib/formatters';
import { getCurrentMonth } from '../lib/currentMonth';
import { consolidarContasPagar } from '../lib/contasPagarEngine';
import FluxoColumn from '../components/fluxo-caixa/FluxoColumn';

const CATEGORIAS = ['recebimento_vendas', 'recebimento_cobranca', 'pagamento_fornecedor', 'pagamento_tributo', 'folha_pagamento', 'aluguel', 'despesa_fixa', 'despesa_variavel', 'investimento', 'emprestimo', 'outro'];

const ORIGEM_LABEL = {
  titulo_cobranca: 'Sicredi',
  despesa: 'Despesa',
  tributo: 'Tributo',
  folha: 'Folha',
  fatura: 'Cartão',
  compra: 'Compra',
};

export default function FluxoCaixa() {
  const [fluxos, setFluxos] = useState([]);
  const [titulos, setTitulos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [contasPagar, setContasPagar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isAnnual, setIsAnnual] = useState(false);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [form, setForm] = useState({
    data_prevista: '', tipo: '', categoria: '', descricao: '', valor_previsto: '', valor_realizado: '0',
    status: 'previsto', recorrente: false, frequencia: 'unico', conta_bancaria: '', origem_id: '', origem_tipo: 'manual'
  });

  async function loadData() {
    const [fx, tit, lanc, despesas, tributos, folhas, faturas, cartoes, compras] = await Promise.all([
      base44.entities.FluxoCaixa.list('-data_prevista', 500),
      base44.entities.TituloCobranca.list('-data_vencimento', 3000),
      base44.entities.LancamentoBancario.list('-data', 1000),
      base44.entities.DespesaOperacional.list('-data', 1000),
      base44.entities.Tributo.list('-data_vencimento', 1000),
      base44.entities.FolhaPagamento.list('-competencia', 1000),
      base44.entities.FaturaCartao.list('-data_vencimento', 1000),
      base44.entities.ContaCartao.list('', 200),
      base44.entities.ItemCompra.list('-data_emissao', 2000),
    ]);
    setFluxos(fx);
    setTitulos(tit);
    setLancamentos(lanc);
    // Mesma visão consolidada da página "Contas a Pagar"
    setContasPagar(consolidarContasPagar({ despesas, tributos, folhas, faturas, cartoes, compras }));
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Saldo atual real: último lançamento NeuralTec com saldo_apos preenchido
  const saldoAtual = useMemo(() => {
    const neural = lancamentos
      .filter(l => l.conta_bancaria === 'NeuralTec 36092-2' && l.saldo_apos != null)
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    return neural.length > 0 ? neural[0].saldo_apos : 0;
  }, [lancamentos]);

  // Projeção automática: cobranças Sicredi a receber (entradas) + contas a pagar consolidadas (saídas).
  // As saídas usam a MESMA visão da página "Contas a Pagar" (despesas, tributos, folha, faturas, compras).
  const projecaoAuto = useMemo(() => {
    const itens = [];
    // ENTRADAS — títulos Sicredi em aberto / vencidos, pela data de vencimento
    titulos.forEach(t => {
      if (t.status === 'pago') return;
      if (!t.data_vencimento) return;
      itens.push({
        id: `tit-${t.id}`,
        _auto: true,
        data_prevista: t.data_vencimento,
        tipo: 'entrada',
        categoria: 'recebimento_cobranca',
        descricao: t.cliente || t.seu_numero || t.nosso_numero,
        valor_previsto: (t.valor_titulo || 0) - (t.valor_pago || 0),
        status: t.status === 'vencido' ? 'vencido' : 'previsto',
        origem_tipo: 'titulo_cobranca',
      });
    });
    // SAÍDAS — contas a pagar consolidadas (visão idêntica à página Contas a Pagar)
    const hojeISO = new Date().toISOString().slice(0, 10);
    contasPagar.forEach(c => {
      if ((c.valor || 0) <= 0) return;
      itens.push({
        id: `cp-${c.id}`,
        _auto: true,
        data_prevista: c.data_vencimento,
        tipo: 'saida',
        categoria: 'pagamento_fornecedor',
        descricao: `${c.descricao}${c.fornecedor && c.fornecedor !== '—' ? ` · ${c.fornecedor}` : ''}`,
        valor_previsto: c.valor,
        status: c.data_vencimento && c.data_vencimento < hojeISO ? 'vencido' : 'previsto',
        origem_tipo: c.origem_tipo,
      });
    });
    return itens;
  }, [titulos, contasPagar]);

  // Movimentações combinadas: manuais (FluxoCaixa) + projeção automática
  const fluxosCombinados = useMemo(() => [...fluxos, ...projecaoAuto], [fluxos, projecaoAuto]);

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
      t[m] = fluxosCombinados.filter(f => f.data_prevista?.startsWith(m) && f.tipo === 'entrada').reduce((s,f) => s+(f.valor_previsto||0), 0);
    });
    return t;
  }, [fluxosCombinados]);

  const filtrados = fluxosCombinados.filter(f => {
    if (isAnnual) {
      if (!f.data_prevista?.startsWith(selectedMonth.slice(0, 4))) return false;
    } else if (!f.data_prevista?.startsWith(selectedMonth)) return false;
    if (filterTipo && f.tipo !== filterTipo) return false;
    if (filterStatus && f.status !== filterStatus) return false;
    if (filterCategoria && f.categoria !== filterCategoria) return false;
    return true;
  });
  const entradasFiltradas = filtrados.filter(f => f.tipo === 'entrada');
  const saidasFiltradas = filtrados.filter(f => f.tipo === 'saida');

  // Próximos 30 dias
  const today = new Date();
  const next30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const proximosMes = fluxosCombinados.filter(f => {
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
  const saldoProjetado = saldoAtual + entradasTotal - saidasTotal;
  const alertaNegativo = saldoProjetado < 0;

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
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

      {/* Totais compactos e gráfico */}
      <div className="grid grid-cols-1 gap-2 mb-3 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-1.5">
          <GradientCard title="Entradas" value={formatCurrency(entradasTotal)} sub="30 dias" icon={TrendingUp} gradient="green" />
          <GradientCard title="Saídas" value={formatCurrency(saidasTotal)} sub="30 dias" icon={TrendingDown} gradient="red" />
          <GradientCard title="Saldo Atual" value={formatCurrency(saldoAtual)} sub="NeuralTec" icon={Landmark} gradient="blue" />
          <GradientCard title="Saldo Projetado" value={formatCurrency(saldoProjetado)} sub="30 dias" icon={BarChart3} gradient={alertaNegativo ? 'red' : 'teal'} />
        </div>
        <div className="bg-card rounded-xl border px-3 pt-2 pb-1">
          <p className="text-[11px] font-semibold">Entradas vs Saídas por Semana</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={chartData} margin={{ top: 5, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="entradas" fill="#22c55e" name="Entradas" />
                <Bar dataKey="saidas" fill="#ef4444" name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[130px] items-center justify-center text-xs text-muted-foreground">Sem movimentações nos próximos 30 dias</div>
          )}
        </div>
      </div>

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

      {/* Entradas e saídas */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <FluxoColumn
          title="A receber · Entradas"
          tipo="entrada"
          items={entradasFiltradas}
          origemLabels={ORIGEM_LABEL}
          onMarkRealizado={markRealizado}
        />
        <FluxoColumn
          title="A pagar · Saídas"
          tipo="saida"
          items={saidasFiltradas}
          origemLabels={ORIGEM_LABEL}
          onMarkRealizado={markRealizado}
        />
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