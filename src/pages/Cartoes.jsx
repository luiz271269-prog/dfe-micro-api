import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, CreditCard, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../lib/formatters';

const SEED_CARDS = [
  { nome: 'Acentra — Luiz Carlos', bandeira: 'Acentra', titular: 'Luiz Carlos', tipo: 'pessoal', dia_vencimento: 3, empresa_vinculada: 'pessoal', conta_bancaria_pagamento: 'conta pessoal LC', is_ativo: true },
  { nome: 'Sicoob — Luiz Carlos', bandeira: 'Sicoob', titular: 'Luiz Carlos', tipo: 'pessoal', dia_vencimento: 3, empresa_vinculada: 'pessoal', conta_bancaria_pagamento: 'conta pessoal LC', is_ativo: true },
  { nome: 'Acentra — KLI', bandeira: 'Acentra', titular: 'KLI Tecnologia', tipo: 'empresarial', dia_vencimento: 11, empresa_vinculada: 'KLI Tecnologia', conta_bancaria_pagamento: 'conta KLI', is_ativo: true },
  { nome: 'Acentra — Liesch', bandeira: 'Acentra', titular: 'Liesch Informática', tipo: 'empresarial', dia_vencimento: 11, empresa_vinculada: 'Liesch Informática', conta_bancaria_pagamento: 'Sicredi 37101-4', is_ativo: true },
  { nome: 'Sicoob — KLI', bandeira: 'Sicoob', titular: 'KLI Tecnologia', tipo: 'empresarial', dia_vencimento: 22, empresa_vinculada: 'KLI Tecnologia', conta_bancaria_pagamento: 'conta KLI', is_ativo: true },
  { nome: 'Sicredi — NeuralTec', bandeira: 'Sicredi', titular: 'NeuralTec Dist. Tecnologia Ltda', tipo: 'empresarial', dia_vencimento: 25, empresa_vinculada: 'NeuralTec', conta_bancaria_pagamento: 'Sicredi 36092-2', is_ativo: true },
  { nome: 'Magalu / LuizaCred', bandeira: 'Magalu', titular: 'pessoal', tipo: 'pessoal', dia_vencimento: 27, empresa_vinculada: 'pessoal', conta_bancaria_pagamento: 'Sicredi 36092-2', is_ativo: true },
];

export default function Cartoes() {
  const [cartoes, setCartoes] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [expandedFatura, setExpandedFatura] = useState(null);
  const [showFaturaForm, setShowFaturaForm] = useState(false);
  const [faturaForm, setFaturaForm] = useState({
    conta_cartao_id: '', mes_referencia: '', data_vencimento: '',
    valor_total: '', status: 'aberta', data_pagamento: '', valor_pago: '0'
  });

  async function loadData() {
    setLoading(true);
    let cards = await base44.entities.ContaCartao.list();
    
    if (cards.length === 0) {
      await base44.entities.ContaCartao.bulkCreate(SEED_CARDS);
      cards = await base44.entities.ContaCartao.list();
    }

    let fats = await base44.entities.FaturaCartao.list('-data_vencimento', 200);
    
    // Seed faturas if none exist
    if (fats.length === 0 && cards.length > 0) {
      const sicrediNT = cards.find(c => c.nome === 'Sicredi — NeuralTec');
      const magalu = cards.find(c => c.nome === 'Magalu / LuizaCred');
      const seedFaturas = [
        sicrediNT && { conta_cartao_id: sicrediNT.id, mes_referencia: '2026-02', data_vencimento: '2026-02-25', valor_total: 257.68, status: 'paga_total', data_pagamento: '2026-02-25', valor_pago: 257.68 },
        sicrediNT && { conta_cartao_id: sicrediNT.id, mes_referencia: '2026-03', data_vencimento: '2026-03-25', valor_total: 672.85, status: 'aberta', valor_pago: 0 },
        magalu && { conta_cartao_id: magalu.id, mes_referencia: '2026-01', data_vencimento: '2026-01-27', valor_total: 7637.97, status: 'paga_total', data_pagamento: '2026-01-27', valor_pago: 7637.97 },
        magalu && { conta_cartao_id: magalu.id, mes_referencia: '2026-02', data_vencimento: '2026-02-25', valor_total: 17984.47, status: 'paga_total', data_pagamento: '2026-02-25', valor_pago: 17984.47 },
      ].filter(Boolean);
      if (seedFaturas.length > 0) {
        await base44.entities.FaturaCartao.bulkCreate(seedFaturas);
        fats = await base44.entities.FaturaCartao.list('-data_vencimento', 200);
      }
    }

    const lancs = await base44.entities.LancamentoCartao.list('-data_lancamento', 500);
    setCartoes(cards.sort((a, b) => (a.dia_vencimento || 0) - (b.dia_vencimento || 0)));
    setFaturas(fats);
    setLancamentos(lancs);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

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

  function getCardFaturas(cardId) {
    return faturas.filter(f => f.conta_cartao_id === cardId).sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento));
  }

  function getFaturaLancamentos(faturaId) {
    return lancamentos.filter(l => l.fatura_id === faturaId);
  }

  function getLatestFatura(cardId) {
    const fats = getCardFaturas(cardId);
    return fats[0] || null;
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Cartões de Crédito" subtitle={`${cartoes.length} cartões cadastrados`}>
        <Button onClick={() => setShowFaturaForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Fatura</Button>
      </PageHeader>

      {/* Timeline de vencimentos */}
      <div className="bg-card rounded-xl border p-5 mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Calendário de Vencimentos
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {cartoes.map((c, i) => {
            const latestFat = getLatestFatura(c.id);
            const statusColors = {
              aberta: 'bg-amber-100 border-amber-300 text-amber-800',
              paga_total: 'bg-green-100 border-green-300 text-green-800',
              vencida: 'bg-red-100 border-red-300 text-red-800',
            };
            const cls = latestFat ? (statusColors[latestFat.status] || 'bg-blue-100 border-blue-300 text-blue-800') : 'bg-slate-100 border-slate-200 text-slate-600';
            return (
              <div key={c.id} className="flex flex-col items-center gap-1 min-w-[80px]">
                <button
                  onClick={() => setExpandedCard(expandedCard === c.id ? null : c.id)}
                  className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center transition-all hover:scale-105 ${cls}`}
                >
                  <span className="text-lg font-bold leading-none">{c.dia_vencimento}</span>
                  <span className="text-[9px] font-medium">dia</span>
                </button>
                <p className="text-[10px] text-center text-muted-foreground leading-tight max-w-[80px] truncate">{c.nome.split('—')[0].trim()}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cards grid */}
      <div className="space-y-3">
        {cartoes.map(c => {
          const isExpanded = expandedCard === c.id;
          const cardFaturas = getCardFaturas(c.id);
          const latestFat = cardFaturas[0];

          return (
            <div key={c.id} className="bg-card rounded-xl border overflow-hidden">
              {/* Card header */}
              <button
                onClick={() => setExpandedCard(isExpanded ? null : c.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{c.nome}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.tipo === 'empresarial' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {c.tipo === 'empresarial' ? 'Empresarial' : 'Pessoal'}
                    </span>
                    {latestFat && <StatusBadge status={latestFat.status} />}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.bandeira} · Vence dia {c.dia_vencimento} · {c.conta_bancaria_pagamento}</p>
                </div>
                <div className="text-right shrink-0">
                  {latestFat && <p className="text-sm font-bold">{formatCurrency(latestFat.valor_total)}</p>}
                  <p className="text-xs text-muted-foreground">{cardFaturas.length} fatura(s)</p>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
              </button>

              {/* Faturas expandidas */}
              {isExpanded && (
                <div className="border-t bg-muted/20">
                  {cardFaturas.length === 0 ? (
                    <p className="px-6 py-4 text-sm text-muted-foreground">Nenhuma fatura cadastrada</p>
                  ) : (
                    cardFaturas.map(fat => {
                      const fatLancs = getFaturaLancamentos(fat.id);
                      const isFatExpanded = expandedFatura === fat.id;
                      const totalEmp = fatLancs.filter(l => l.natureza === 'empresarial').reduce((s, l) => s + (l.valor || 0), 0);
                      const totalPes = fatLancs.filter(l => l.natureza === 'pessoal').reduce((s, l) => s + (l.valor || 0), 0);
                      return (
                        <div key={fat.id} className="border-b last:border-b-0">
                          <button
                            onClick={() => setExpandedFatura(isFatExpanded ? null : fat.id)}
                            className="w-full flex items-center gap-4 px-6 py-3 hover:bg-muted/40 text-left transition-colors"
                          >
                            <div className="flex-1 flex items-center gap-3 flex-wrap">
                              <span className="text-sm font-medium">{fat.mes_referencia}</span>
                              <StatusBadge status={fat.status} />
                              <span className="text-xs text-muted-foreground">Venc. {formatDate(fat.data_vencimento)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold">{formatCurrency(fat.valor_total)}</span>
                              {fat.valor_pago > 0 && <p className="text-xs text-green-600">Pago: {formatCurrency(fat.valor_pago)}</p>}
                            </div>
                            {isFatExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </button>

                          {isFatExpanded && (
                            <div className="px-6 pb-4 bg-background">
                              {fatLancs.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-3">Nenhum lançamento cadastrado nesta fatura</p>
                              ) : (
                                <>
                                  {/* Totalizadores */}
                                  <div className="flex gap-3 mb-3 pt-2">
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
                                      <p className="text-blue-600 font-semibold">Empresarial</p>
                                      <p className="font-bold text-blue-800">{formatCurrency(totalEmp)}</p>
                                    </div>
                                    <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-xs">
                                      <p className="text-purple-600 font-semibold">Pessoal</p>
                                      <p className="font-bold text-purple-800">{formatCurrency(totalPes)}</p>
                                    </div>
                                  </div>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left py-1.5 font-semibold text-muted-foreground">Data</th>
                                        <th className="text-left py-1.5 font-semibold text-muted-foreground">Estabelecimento</th>
                                        <th className="text-left py-1.5 font-semibold text-muted-foreground">Natureza</th>
                                        <th className="text-right py-1.5 font-semibold text-muted-foreground">Valor</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {fatLancs.map(l => (
                                        <tr key={l.id} className="border-b last:border-b-0">
                                          <td className="py-1.5">{formatDate(l.data_lancamento)}</td>
                                          <td className="py-1.5">{l.estabelecimento}</td>
                                          <td className="py-1.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${l.natureza === 'empresarial' ? 'bg-blue-100 text-blue-700' : l.natureza === 'reembolso' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                              {l.natureza}
                                            </span>
                                          </td>
                                          <td className="py-1.5 text-right font-medium">{formatCurrency(l.valor)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fatura Form */}
      <Dialog open={showFaturaForm} onOpenChange={setShowFaturaForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Fatura</DialogTitle></DialogHeader>
          <form onSubmit={handleFaturaSubmit} className="space-y-4">
            <div>
              <Label>Cartão</Label>
              <Select value={faturaForm.conta_cartao_id} onValueChange={v => setFaturaForm({...faturaForm, conta_cartao_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{cartoes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mês Referência</Label><Input placeholder="2026-03" value={faturaForm.mes_referencia} onChange={e => setFaturaForm({...faturaForm, mes_referencia: e.target.value})} required /></div>
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