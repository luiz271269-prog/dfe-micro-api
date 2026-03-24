import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, CreditCard, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../lib/formatters';

const defaultCards = [
  { nome: 'Acentra LC', bandeira: 'Visa', titular: 'Liesch', tipo: 'pessoal', dia_vencimento: 3, empresa_vinculada: 'Liesch', is_ativo: true },
  { nome: 'Sicoob LC', bandeira: 'Mastercard', titular: 'Liesch', tipo: 'pessoal', dia_vencimento: 3, empresa_vinculada: 'Liesch', is_ativo: true },
  { nome: 'Acentra KLI', bandeira: 'Visa', titular: 'KLI', tipo: 'empresarial', dia_vencimento: 11, empresa_vinculada: 'KLI', is_ativo: true },
  { nome: 'Acentra Liesch', bandeira: 'Visa', titular: 'Liesch', tipo: 'empresarial', dia_vencimento: 11, empresa_vinculada: 'Liesch', is_ativo: true },
  { nome: 'Sicoob KLI', bandeira: 'Mastercard', titular: 'KLI', tipo: 'empresarial', dia_vencimento: 22, empresa_vinculada: 'KLI', is_ativo: true },
  { nome: 'Sicredi NeuralTec', bandeira: 'Visa', titular: 'NeuralTec', tipo: 'empresarial', dia_vencimento: 25, empresa_vinculada: 'NeuralTec', is_ativo: true },
  { nome: 'Magalu', bandeira: 'Mastercard', titular: 'Pessoal', tipo: 'pessoal', dia_vencimento: 27, empresa_vinculada: '', is_ativo: true },
];

export default function Cartoes() {
  const [cartoes, setCartoes] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFaturaForm, setShowFaturaForm] = useState(false);
  const [faturaForm, setFaturaForm] = useState({
    conta_cartao_id: '', mes_referencia: '', data_vencimento: '',
    valor_total: '', status: 'aberta', data_pagamento: '', valor_pago: '0'
  });

  async function loadData() {
    setLoading(true);
    let cards = await base44.entities.ContaCartao.list();
    if (cards.length === 0) {
      await base44.entities.ContaCartao.bulkCreate(defaultCards);
      cards = await base44.entities.ContaCartao.list();
    }
    const fats = await base44.entities.FaturaCartao.list('-data_vencimento', 200);
    setCartoes(cards);
    setFaturas(fats);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const sortedCards = [...cartoes].sort((a, b) => (a.dia_vencimento || 0) - (b.dia_vencimento || 0));

  async function handleFaturaSubmit(e) {
    e.preventDefault();
    await base44.entities.FaturaCartao.create({
      ...faturaForm,
      valor_total: parseFloat(faturaForm.valor_total),
      valor_pago: faturaForm.valor_pago ? parseFloat(faturaForm.valor_pago) : 0,
    });
    setShowFaturaForm(false);
    setFaturaForm({ conta_cartao_id: '', mes_referencia: '', data_vencimento: '', valor_total: '', status: 'aberta', data_pagamento: '', valor_pago: '0' });
    loadData();
  }

  const getCardName = (id) => cartoes.find(c => c.id === id)?.nome || id;

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Cartões de Crédito" subtitle="7 cartões cadastrados · Gestão de faturas">
        <Button onClick={() => setShowFaturaForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Fatura</Button>
      </PageHeader>

      <Tabs defaultValue="cartoes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="cartoes" className="gap-2"><CreditCard className="w-4 h-4" /> Cartões</TabsTrigger>
          <TabsTrigger value="faturas" className="gap-2"><Calendar className="w-4 h-4" /> Faturas</TabsTrigger>
        </TabsList>

        <TabsContent value="cartoes">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedCards.map(c => (
              <div key={c.id} className={`bg-card rounded-xl border p-5 hover:shadow-lg transition-shadow ${c.tipo === 'empresarial' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-purple-500'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.bandeira} · {c.titular}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.tipo === 'empresarial' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'}`}>
                    {c.tipo === 'empresarial' ? 'Empresarial' : 'Pessoal'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Vencimento dia <strong className="text-foreground">{c.dia_vencimento}</strong></span>
                </div>
                {c.empresa_vinculada && (
                  <p className="text-xs text-muted-foreground mt-2">Empresa: {c.empresa_vinculada}</p>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="faturas">
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cartão</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Mês Ref.</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vencimento</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Pago</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhuma fatura cadastrada</td></tr>
                  ) : (
                    faturas.map(f => (
                      <tr key={f.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{getCardName(f.conta_cartao_id)}</td>
                        <td className="px-4 py-3">{f.mes_referencia}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(f.data_vencimento)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(f.valor_total)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-600">{formatCurrency(f.valor_pago)}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={f.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Fatura Form */}
      <Dialog open={showFaturaForm} onOpenChange={setShowFaturaForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Fatura</DialogTitle></DialogHeader>
          <form onSubmit={handleFaturaSubmit} className="space-y-4">
            <div>
              <Label>Cartão</Label>
              <Select value={faturaForm.conta_cartao_id} onValueChange={v => setFaturaForm({...faturaForm, conta_cartao_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {cartoes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mês Referência</Label><Input placeholder="ex: 2025-03" value={faturaForm.mes_referencia} onChange={e => setFaturaForm({...faturaForm, mes_referencia: e.target.value})} required /></div>
              <div><Label>Data Vencimento</Label><Input type="date" value={faturaForm.data_vencimento} onChange={e => setFaturaForm({...faturaForm, data_vencimento: e.target.value})} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor Total</Label><Input type="number" step="0.01" value={faturaForm.valor_total} onChange={e => setFaturaForm({...faturaForm, valor_total: e.target.value})} required /></div>
              <div>
                <Label>Status</Label>
                <Select value={faturaForm.status} onValueChange={v => setFaturaForm({...faturaForm, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="paga_total">Paga Total</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Pagamento</Label><Input type="date" value={faturaForm.data_pagamento} onChange={e => setFaturaForm({...faturaForm, data_pagamento: e.target.value})} /></div>
              <div><Label>Valor Pago</Label><Input type="number" step="0.01" value={faturaForm.valor_pago} onChange={e => setFaturaForm({...faturaForm, valor_pago: e.target.value})} /></div>
            </div>
            <Button type="submit" className="w-full">Salvar Fatura</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}