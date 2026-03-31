import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, CreditCard, ChevronDown, ChevronUp, Calendar, PieChart, DollarSign, AlertCircle } from 'lucide-react';
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
import { seedSicoobFatura } from '../lib/seedData';

const SEED_CARDS = [
  { nome: 'Acentra — Luiz Carlos', bandeira: 'Acentra', titular: 'Luiz Carlos', tipo: 'pessoal', dia_vencimento: 3, empresa_vinculada: 'pessoal', conta_bancaria_pagamento: 'conta pessoal LC', is_ativo: true },
  { nome: 'Sicoob — Luiz Carlos', bandeira: 'Sicoob', titular: 'Luiz Carlos', tipo: 'pessoal', dia_vencimento: 3, empresa_vinculada: 'pessoal', conta_bancaria_pagamento: 'conta pessoal LC', is_ativo: true },
  { nome: 'Acentra — KLI', bandeira: 'Acentra', titular: 'KLI Tecnologia', tipo: 'empresarial', dia_vencimento: 11, empresa_vinculada: 'KLI Tecnologia', conta_bancaria_pagamento: 'conta KLI', is_ativo: true },
  { nome: 'Acentra — Liesch', bandeira: 'Acentra', titular: 'Liesch Informática', tipo: 'empresarial', dia_vencimento: 11, empresa_vinculada: 'Liesch Informática', conta_bancaria_pagamento: 'Sicredi 37101-4', is_ativo: true },
  { nome: 'Sicoob — KLI', bandeira: 'Sicoob', titular: 'KLI Tecnologia', tipo: 'empresarial', dia_vencimento: 22, empresa_vinculada: 'KLI Tecnologia', conta_bancaria_pagamento: 'conta KLI', is_ativo: true },
  { nome: 'Sicredi — NeuralTec', bandeira: 'Sicredi', titular: 'NeuralTec Dist. Tecnologia Ltda', tipo: 'empresarial', dia_vencimento: 25, empresa_vinculada: 'NeuralTec', conta_bancaria_pagamento: 'Sicredi 36092-2', is_ativo: true },
  { nome: 'Magalu / LuizaCred', bandeira: 'Magalu', titular: 'pessoal', tipo: 'pessoal', dia_vencimento: 27, empresa_vinculada: 'pessoal', conta_bancaria_pagamento: 'Sicredi 36092-2', is_ativo: true },
];

const categoriaLabels = {
  alimentacao: 'Alimentação', combustivel: 'Combustível', lazer: 'Lazer',
  tecnologia: 'Tecnologia', servico_pessoal: 'Serviço Pessoal', saude_bem_estar: 'Saúde/Bem-Estar',
  beleza: 'Beleza', farmacia: 'Farmácia', transporte: 'Transporte',
  financeiro: 'Financeiro', seguro: 'Seguro', outro: 'Outro',
};

const categoriaColors = {
  alimentacao: 'bg-green-100 text-green-700', combustivel: 'bg-orange-100 text-orange-700',
  lazer: 'bg-purple-100 text-purple-700', tecnologia: 'bg-blue-100 text-blue-700',
  servico_pessoal: 'bg-pink-100 text-pink-700', saude_bem_estar: 'bg-teal-100 text-teal-700',
  beleza: 'bg-rose-100 text-rose-700', farmacia: 'bg-cyan-100 text-cyan-700',
  transporte: 'bg-slate-100 text-slate-700', financeiro: 'bg-red-100 text-red-700',
  seguro: 'bg-gray-100 text-gray-700', outro: 'bg-amber-100 text-amber-700',
};

function CategoriaBreakdown({ lancamentos }) {
  const validos = lancamentos.filter(l => !l.observacao?.includes('Não faz parte'));
  const cats = {};
  validos.forEach(l => {
    const cat = l.categoria || 'outro';
    cats[cat] = (cats[cat] || 0) + (l.valor || 0);
  });
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="mt-4 p-3 bg-muted/30 rounded-lg">
      <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
        <PieChart className="w-3.5 h-3.5" /> Gastos por Categoria
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sorted.map(([cat, val]) => (
          <div key={cat} className="flex items-center justify-between bg-background rounded-md px-2 py-1.5 border">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${categoriaColors[cat] || 'bg-slate-100 text-slate-700'}`}>
                {categoriaLabels[cat] || cat}
              </span>
            </div>
            <div className="text-right ml-1 shrink-0">
              <p className="text-xs font-bold">{formatCurrency(val)}</p>
              <p className="text-[10px] text-muted-foreground">{total > 0 ? ((val / total) * 100).toFixed(0) : 0}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Cartoes() {
  const [cartoes, setCartoes] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('2026-03');
  const [isAnnual, setIsAnnual] = useState(false);
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
    const [fats, lancs] = await Promise.all([
      base44.entities.FaturaCartao.list('-data_vencimento', 200),
      base44.entities.LancamentoCartao.list('-data_lancamento', 1000),
    ]);
    setCartoes(cards.sort((a, b) => (a.dia_vencimento || 0) - (b.dia_vencimento || 0)));
    setFaturas(fats);
    setLancamentos(lancs);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

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

  const monthTotals = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach(m => {
      t[m] = faturas.filter(f => f.mes_referencia === m).reduce((s,f) => s+(f.valor_total||0), 0);
    });
    return t;
  }, [faturas]);

  const filteredFaturas = useMemo(() => {
    if (isAnnual) return faturas;
    return faturas.filter(f => f.mes_referencia === selectedMonth);
  }, [faturas, selectedMonth, isAnnual]);

  function getCardFaturas(cardId) {
    return filteredFaturas.filter(f => f.conta_cartao_id === cardId).sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento));
  }

  function getFaturaLancamentos(faturaId) {
    return lancamentos.filter(l => l.fatura_id === faturaId).sort((a, b) => new Date(a.data_lancamento) - new Date(b.data_lancamento));
  }

  function getLatestFatura(cardId) {
    return getCardFaturas(cardId)[0] || null;
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Cartões de Crédito" subtitle={`${cartoes.length} cartões cadastrados`}>
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals}
        />
        <Button onClick={() => setShowFaturaForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Fatura</Button>
      </PageHeader>

      {/* Resumo do mês */}
      {(() => {
        const totalMes = filteredFaturas.reduce((s,f)=>s+(f.valor_total||0),0);
        const totalPagoMes = filteredFaturas.filter(f=>f.status==='paga_total').reduce((s,f)=>s+(f.valor_pago||0),0);
        const proxVenc = cartoes.sort((a,b)=>a.dia_vencimento-b.dia_vencimento)[0];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <GradientCard title="Total Faturas" value={formatCurrency(totalMes)} sub={`${filteredFaturas.length} faturas`} icon={CreditCard} gradient="purple" />
            <GradientCard title="Total Pago" value={formatCurrency(totalPagoMes)} sub="Faturas quitadas" icon={DollarSign} gradient="green" />
            <GradientCard title="A Pagar" value={formatCurrency(totalMes - totalPagoMes)} sub="Saldo restante" icon={AlertCircle} gradient="orange" />
            <GradientCard title="Cartões Ativos" value={cartoes.filter(c=>c.is_ativo).length} sub={`${cartoes.length} cadastrados`} icon={CreditCard} gradient="blue" />
          </div>
        );
      })()}

      {/* Timeline de vencimentos */}
      <div className="bg-card rounded-xl border p-5 mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Calendário de Vencimentos
        </p>
        <div className="flex items-start gap-4 overflow-x-auto pb-2">
          {cartoes.map(c => {
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
                {latestFat && <p className="text-[10px] font-bold text-center">{formatCurrency(latestFat.valor_total)}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cards list */}
      <div className="space-y-3">
        {cartoes.map(c => {
          const isExpanded = expandedCard === c.id;
          const cardFaturas = getCardFaturas(c.id);
          const latestFat = cardFaturas[0];

          return (
            <div key={c.id} className="bg-card rounded-xl border overflow-hidden">
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
                  {latestFat && (
                    <>
                      <p className="text-sm font-bold">{formatCurrency(latestFat.valor_total)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(latestFat.data_vencimento)}</p>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground">{cardFaturas.length} fatura(s)</p>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t bg-muted/20">
                  {cardFaturas.length === 0 ? (
                    <p className="px-6 py-4 text-sm text-muted-foreground">Nenhuma fatura cadastrada</p>
                  ) : (
                    cardFaturas.map(fat => {
                      const fatLancs = getFaturaLancamentos(fat.id);
                      const isFatExpanded = expandedFatura === fat.id;
                      // Exclude "não faz parte" lancamentos from totals
                      const validos = fatLancs.filter(l => !l.observacao?.includes('Não faz parte'));
                      const totalEmp = validos.filter(l => l.natureza === 'empresarial').reduce((s, l) => s + (l.valor || 0), 0);
                      const totalPes = validos.filter(l => l.natureza === 'pessoal').reduce((s, l) => s + (l.valor || 0), 0);

                      return (
                        <div key={fat.id} className="border-b last:border-b-0">
                          <button
                            onClick={() => setExpandedFatura(isFatExpanded ? null : fat.id)}
                            className="w-full flex items-center gap-4 px-6 py-3 hover:bg-muted/40 text-left transition-colors"
                          >
                            <div className="flex-1 flex items-center gap-3 flex-wrap">
                              <span className="text-sm font-semibold">{fat.mes_referencia}</span>
                              <StatusBadge status={fat.status} />
                              <span className="text-xs text-muted-foreground">Venc. {formatDate(fat.data_vencimento)}</span>
                              {fatLancs.length > 0 && <span className="text-xs text-muted-foreground">{fatLancs.length} lançamentos</span>}
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold">{formatCurrency(fat.valor_total)}</span>
                              {fat.valor_pago > 0 && <p className="text-xs text-green-600">Pago: {formatCurrency(fat.valor_pago)}</p>}
                            </div>
                            {isFatExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </button>

                          {isFatExpanded && (
                            <div className="px-6 pb-5 bg-background">
                              {fatLancs.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-3">Nenhum lançamento cadastrado</p>
                              ) : (
                                <>
                                  {/* Natureza totalizadores */}
                                  <div className="flex gap-3 mt-3 mb-3">
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
                                      <p className="text-blue-600 font-semibold">Empresarial</p>
                                      <p className="font-bold text-blue-800 text-sm">{formatCurrency(totalEmp)}</p>
                                    </div>
                                    <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-xs">
                                      <p className="text-purple-600 font-semibold">Pessoal</p>
                                      <p className="font-bold text-purple-800 text-sm">{formatCurrency(totalPes)}</p>
                                    </div>
                                    <div className="bg-muted border rounded-lg px-3 py-2 text-xs">
                                      <p className="text-muted-foreground font-semibold">Total Fatura</p>
                                      <p className="font-bold text-sm">{formatCurrency(fat.valor_total)}</p>
                                    </div>
                                  </div>

                                  {/* Categoria breakdown */}
                                  <CategoriaBreakdown lancamentos={validos} />

                                  {/* Tabela de lançamentos */}
                                  <div className="mt-4 overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="text-left py-2 font-semibold text-muted-foreground">Data</th>
                                          <th className="text-left py-2 font-semibold text-muted-foreground">Estabelecimento</th>
                                          <th className="text-left py-2 font-semibold text-muted-foreground">Categoria</th>
                                          <th className="text-left py-2 font-semibold text-muted-foreground">Natureza</th>
                                          <th className="text-right py-2 font-semibold text-muted-foreground">Valor</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {fatLancs.map(l => {
                                          const isExcluded = l.observacao?.includes('Não faz parte');
                                          return (
                                            <tr key={l.id} className={`border-b last:border-b-0 ${isExcluded ? 'opacity-40' : ''}`}>
                                              <td className="py-1.5 whitespace-nowrap">{formatDate(l.data_lancamento)}</td>
                                              <td className="py-1.5 max-w-[180px] truncate" title={l.estabelecimento}>
                                                {l.estabelecimento}
                                                {isExcluded && <span className="ml-1 text-[9px] text-red-500 font-semibold">(não contabilizado)</span>}
                                              </td>
                                              <td className="py-1.5">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${categoriaColors[l.categoria] || 'bg-slate-100 text-slate-700'}`}>
                                                  {categoriaLabels[l.categoria] || l.categoria}
                                                </span>
                                              </td>
                                              <td className="py-1.5">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${l.natureza === 'empresarial' ? 'bg-blue-100 text-blue-700' : l.natureza === 'reembolso' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                                  {l.natureza}
                                                </span>
                                              </td>
                                              <td className={`py-1.5 text-right font-medium ${l.valor < 0 ? 'text-green-600' : ''}`}>
                                                {formatCurrency(l.valor)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
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