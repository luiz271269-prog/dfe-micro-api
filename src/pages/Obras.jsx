import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import PageHeader from '../components/shared/PageHeader';
import { formatCurrency, formatDate } from '../lib/formatters';

const SEED_OBRAS = [
  { data: '2026-03-19', descricao: 'Reforma da loja — mão de obra', responsavel: 'Jhonatan da Rocha Vitu', tipo: 'mao_obra', local_obra: 'loja', valor: 9500.00, forma_pagamento: 'PIX' },
  { data: '2026-01-08', descricao: 'Materiais construção jan', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2798405', valor: 32.20 },
  { data: '2026-01-19', descricao: 'Materiais construção jan', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2811855', valor: 19.89 },
  { data: '2026-02-04', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2835558', valor: 498.24 },
  { data: '2026-02-06', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2835518', valor: 250.00 },
  { data: '2026-02-10', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2843008', valor: 40.15 },
  { data: '2026-02-10', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2843708', valor: 23.00 },
  { data: '2026-02-12', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2846648', valor: 31.74 },
  { data: '2026-02-12', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2846738', valor: 66.79 },
  { data: '2026-02-18', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2856608', valor: 54.00 },
  { data: '2026-02-23', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2859658', valor: 75.23 },
  { data: '2026-02-24', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2861658', valor: 27.90 },
  { data: '2026-02-25', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2862158', valor: 39.51 },
  { data: '2026-02-25', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2863728', valor: 368.39 },
  { data: '2026-02-26', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2865328', valor: 33.82 },
  { data: '2026-02-26', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2865828', valor: 294.90 },
  { data: '2026-02-27', descricao: 'Materiais fev', responsavel: 'Baggio Materiais Construção', tipo: 'material', local_obra: 'loja', numero_nota: 'DI 2868958', valor: 201.40 },
];

const tipoLabels = { mao_obra: 'Mão de Obra', material: 'Material' };
const localLabels = { loja: 'Loja', escritorio: 'Escritório', deposito: 'Depósito', infra: 'Infraestrutura' };

export default function Obras() {
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterLocal, setFilterLocal] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    data: '', descricao: '', responsavel: '', tipo: 'mao_obra',
    local_obra: 'loja', numero_nota: '', valor: '', forma_pagamento: ''
  });

  async function loadData() {
    setLoading(true);
    let data = await base44.entities.ObraReforma.list('-data', 500);
    if (data.length === 0) {
      await base44.entities.ObraReforma.bulkCreate(SEED_OBRAS);
      data = await base44.entities.ObraReforma.list('-data', 500);
    }
    setObras(data);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    return obras.filter(o => {
      if (filterTipo !== 'all' && o.tipo !== filterTipo) return false;
      if (filterLocal !== 'all' && o.local_obra !== filterLocal) return false;
      if (searchTerm && !o.descricao?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [obras, filterTipo, filterLocal, searchTerm]);

  const totalGeral = filtered.reduce((s, o) => s + (o.valor || 0), 0);
  const totalMaoObra = obras.filter(o => o.tipo === 'mao_obra').reduce((s, o) => s + (o.valor || 0), 0);
  const totalMaterial = obras.filter(o => o.tipo === 'material').reduce((s, o) => s + (o.valor || 0), 0);
  const totalTudo = totalMaoObra + totalMaterial;
  const percMaoObra = totalTudo > 0 ? (totalMaoObra / totalTudo) * 100 : 0;
  const percMaterial = totalTudo > 0 ? (totalMaterial / totalTudo) * 100 : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    await base44.entities.ObraReforma.create({ ...form, valor: parseFloat(form.valor) });
    setShowForm(false);
    setForm({ data: '', descricao: '', responsavel: '', tipo: 'mao_obra', local_obra: 'loja', numero_nota: '', valor: '', forma_pagamento: '' });
    loadData();
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Obras e Reformas" subtitle="Controle de gastos com infraestrutura">
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Obra</Button>
      </PageHeader>

      {/* Progress bars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs text-muted-foreground">Mão de Obra</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(totalMaoObra)}</p>
            </div>
            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">{percMaoObra.toFixed(0)}%</span>
          </div>
          <Progress value={percMaoObra} className="h-2 [&>div]:bg-orange-400" />
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs text-muted-foreground">Materiais</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(totalMaterial)}</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{percMaterial.toFixed(0)}%</span>
          </div>
          <Progress value={percMaterial} className="h-2 [&>div]:bg-blue-400" />
        </div>
        <div className="bg-card rounded-xl border border-dashed p-4">
          <p className="text-xs text-muted-foreground font-semibold">Total Investido</p>
          <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(totalTudo)}</p>
          <p className="text-xs text-muted-foreground mt-1">{obras.length} registros</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar descrição..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLocal} onValueChange={setFilterLocal}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Local" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(localLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Local</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">NF</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Nenhuma obra encontrada</td></tr>
              ) : (
                filtered.map(o => (
                  <tr key={o.id} className={`border-b hover:bg-muted/30 transition-colors ${o.tipo === 'mao_obra' ? 'bg-orange-50/30' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(o.data)}</td>
                    <td className="px-4 py-3 font-medium">{o.descricao}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${o.tipo === 'mao_obra' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {tipoLabels[o.tipo] || o.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3">{localLabels[o.local_obra] || o.local_obra}</td>
                    <td className="px-4 py-3 text-sm">{o.responsavel || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{o.numero_nota || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600">{formatCurrency(o.valor)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={6} className="px-4 py-3 font-semibold">Total ({filtered.length} registros)</td>
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
          <DialogHeader><DialogTitle>Nova Obra/Reforma</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} required /></div>
              <div><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required /></div>
            </div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Local</Label>
                <Select value={form.local_obra} onValueChange={v => setForm({...form, local_obra: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(localLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})} /></div>
              <div><Label>Forma Pgto</Label><Input value={form.forma_pagamento} onChange={e => setForm({...form, forma_pagamento: e.target.value})} /></div>
            </div>
            <div><Label>Número Nota</Label><Input value={form.numero_nota} onChange={e => setForm({...form, numero_nota: e.target.value})} /></div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}