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
    const data = await base44.entities.ObraReforma.list('-data', 500);
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
  const totalMaoObra = filtered.filter(o => o.tipo === 'mao_obra').reduce((s, o) => s + (o.valor || 0), 0);
  const totalMaterial = filtered.filter(o => o.tipo === 'material').reduce((s, o) => s + (o.valor || 0), 0);
  const percMaoObra = totalGeral > 0 ? (totalMaoObra / totalGeral) * 100 : 0;
  const percMaterial = totalGeral > 0 ? (totalMaterial / totalGeral) * 100 : 0;

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
          <p className="text-xs text-muted-foreground mb-2">Mão de Obra</p>
          <p className="text-lg font-bold text-foreground mb-2">{formatCurrency(totalMaoObra)}</p>
          <Progress value={percMaoObra} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{percMaoObra.toFixed(0)}% do total</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-2">Material</p>
          <p className="text-lg font-bold text-foreground mb-2">{formatCurrency(totalMaterial)}</p>
          <Progress value={percMaterial} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{percMaterial.toFixed(0)}% do total</p>
        </div>
        <div className="bg-card rounded-xl border p-4 border-primary/30">
          <p className="text-xs text-muted-foreground font-semibold mb-2">Total YTD</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(-Math.abs(totalGeral))}</p>
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
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhuma obra encontrada</td></tr>
              ) : (
                filtered.map(o => (
                  <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(o.data)}</td>
                    <td className="px-4 py-3 font-medium">{o.descricao}</td>
                    <td className="px-4 py-3">{tipoLabels[o.tipo] || o.tipo}</td>
                    <td className="px-4 py-3">{localLabels[o.local_obra] || o.local_obra}</td>
                    <td className="px-4 py-3">{o.responsavel || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600">{formatCurrency(o.valor)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={5} className="px-4 py-3 font-semibold">Total ({filtered.length})</td>
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
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}