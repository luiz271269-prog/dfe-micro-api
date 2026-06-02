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
import ConciliacaoCartoes from '../components/cartoes/ConciliacaoCartoes';
import ConciliarFaturasButton from '../components/cartoes/ConciliarFaturasButton';
import FaturaImageViewer from '../components/cartoes/FaturaImageViewer';
import { FileImage } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/formatters';
import { seedSicoobFatura } from '../lib/seedData';
import { getCurrentMonth } from '../lib/currentMonth';

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
  financeiro: 'Financeiro', seguro: 'Seguro',
  produtos: 'Produtos', estoque: 'Estoque',
  outro: 'Outro',
};

// Pagamento da fatura do mês anterior (crédito no cartão) — não é despesa real, não deve entrar em totais
function isPagamentoFatura(l) {
  if ((l.valor || 0) < 0) return true;
  const desc = `${l.estabelecimento || ''} ${l.observacao || ''}`.toLowerCase();
  return /pagamento.*fatura|pgto.*fatura|pagto.*fatura|credito.*pagamento/.test(desc);
}

const categoriaColors = {
  alimentacao: 'bg-green-100 text-green-700', combustivel: 'bg-orange-100 text-orange-700',
  lazer: 'bg-purple-100 text-purple-700', tecnologia: 'bg-blue-100 text-blue-700',
  servico_pessoal: 'bg-pink-100 text-pink-700', saude_bem_estar: 'bg-teal-100 text-teal-700',
  beleza: 'bg-rose-100 text-rose-700', farmacia: 'bg-cyan-100 text-cyan-700',
  transporte: 'bg-slate-100 text-slate-700', financeiro: 'bg-red-100 text-red-700',
  seguro: 'bg-gray-100 text-gray-700',
  produtos: 'bg-indigo-100 text-indigo-700', estoque: 'bg-emerald-100 text-emerald-700',
  outro: 'bg-amber-100 text-amber-700',
};

function CategoriaBreakdown({ lancamentos }) {
  const validos = lancamentos.filter(l => !l.observacao?.includes('Não faz parte') && !isPagamentoFatura(l));
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
  const [importBatches, setImportBatches] = useState([]);
  const [viewerFile, setViewerFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isAnnual, setIsAnnual] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [expandedFatura, setExpandedFatura] = useState(null);
  const [showFaturaForm, setShowFaturaForm] = useState(false);
  const [editingLanc, setEditingLanc] = useState(null);
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
    const [fats, lancs, batches] = await Promise.all([
      base44.entities.FaturaCartao.list('-data_vencimento', 200),
      base44.entities.LancamentoCartao.list('-data_lancamento', 1000),
      base44.entities.ImportBatch.filter({ batch_type: 'fatura_cartao', status: 'completed' }, '-created_date', 200).catch(() => []),
    ]);
    setCartoes(cards.sort((a, b) => (a.dia_vencimento || 0) - (b.dia_vencimento || 0)));
    setFaturas(fats);
    setLancamentos(lancs);
    setImportBatches(batches || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('neuralfinRefresh', handler);
    const unsubFat = base44.entities.FaturaCartao.subscribe(() => loadData());
    const unsubLanc = base44.entities.LancamentoCartao.subscribe(() => loadData());
    return () => { window.removeEventListener('neuralfinRefresh', handler); unsubFat(); unsubLanc(); };
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

  // Localiza o arquivo PDF/imagem importado para uma fatura específica
  function getFaturaFileUrl(fat) {
    const cartao = cartoes.find(c => c.id === fat.conta_cartao_id);
    const nomeCart = (cartao?.nome || '').split('—')[0].trim().toLowerCase();
    for (const b of importBatches) {
      if (!b.notes) continue;
      let n;
      try { n = JSON.parse(b.notes); } catch { continue; }
      if (!n?.file_url) continue;
      const matchValor = n.valor_total != null && Math.abs(n.valor_total - (fat.valor_total || 0)) < 1;
      const matchVenc = n.data_vencimento && n.data_vencimento === fat.data_vencimento;
      const matchCart = nomeCart && n.nome_cartao && n.nome_cartao.toLowerCase().includes(nomeCart);
      if ((matchValor && matchVenc) || (matchCart && matchVenc) || (matchCart && matchValor)) {
        return n.file_url;
      }
    }
    return null;
  }

  function getLatestFatura(cardId) {
    return getCardFaturas(cardId)[0] || null;
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const totalMes = filteredFaturas.reduce((s,f)=>s+(f.valor_total||0),0);
  const totalPagoMes = filteredFaturas.filter(f=>f.status==='paga_total').reduce((s,f)=>s+(f.valor_pago||0),0);

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
        <ConciliarFaturasButton onDone={loadData} />
        <Button onClick={() => setShowFaturaForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Fatura</Button>
      </PageHeader>

      {/* Resumo do mês */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <GradientCard title="Total Faturas" value={formatCurrency(totalMes)} sub={`${filteredFaturas.length} faturas`} icon={CreditCard} gradient="purple" />
        <GradientCard title="Total Pago" value={formatCurrency(totalPagoMes)} sub="Faturas quitadas" icon={DollarSign} gradient="green" />
        <GradientCard title="A Pagar" value={formatCurrency(totalMes - totalPagoMes)} sub="Saldo restante" icon={AlertCircle} gradient="orange" />
        <GradientCard title="Cartões Ativos" value={cartoes.filter(c=>c.is_ativo).length} sub={`${cartoes.length} cadastrados`} icon={CreditCard} gradient="blue" />
      </div>

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

      {/* Conciliação */}
      {filteredFaturas.length > 0 && (
        <ConciliacaoCartoes 
          lancamentos={lancamentos.filter(l => 
            l.fatura_id && 
            faturas.find(f => f.id === l.fatura_id && (isAnnual || f.mes_referencia === selectedMonth))
          )} 
          selectedMonth={selectedMonth}
          isAnnual={isAnnual}
          totalFaturas={totalMes}
        />
      )}

      {/* Cards list */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {cartoes.map(c => {
          const isExpanded = expandedCard === c.id;
          const cardFaturas = getCardFaturas(c.id);
          const latestFat = cardFaturas[0];

          return (
            <div key={c.id} className="bg-card rounded-xl border overflow-hidden">
              <button
                onClick={() => {
                  if (isExpanded) {
                    setExpandedCard(null);
                    setExpandedFatura(null);
                  } else {
                    setExpandedCard(c.id);
                    const firstFat = getCardFaturas(c.id)[0];
                    if (firstFat) setExpandedFatura(firstFat.id);
                  }
                }}
                className="w-full flex items-center gap-2 p-2 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold truncate">{c.nome}</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0 rounded-full ${c.tipo === 'empresarial' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {c.tipo === 'empresarial' ? 'Emp' : 'Pess'}
                    </span>
                    {latestFat && <StatusBadge status={latestFat.status} />}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{c.bandeira} · dia {c.dia_vencimento} · {c.conta_bancaria_pagamento}</p>
                </div>
                {(() => {
                  const url = latestFat ? getFaturaFileUrl(latestFat) : null;
                  if (!url) return null;
                  const isImg = /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
                  return (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setViewerFile({ url, titulo: `${c.nome} — ${latestFat.mes_referencia}` }); }}
                      className="shrink-0 w-8 h-9 rounded-md border border-blue-200 bg-blue-50 hover:border-blue-400 hover:shadow-md overflow-hidden flex items-center justify-center transition-all"
                      title="Ver fatura original importada"
                    >
                      {isImg ? (
                        <img src={url} alt="fatura" className="w-full h-full object-cover" />
                      ) : (
                        <FileImage className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </button>
                  );
                })()}
                <div className="text-right shrink-0">
                  {latestFat && (
                    <>
                      <p className="text-xs font-bold leading-tight">{formatCurrency(latestFat.valor_total)}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{formatDate(latestFat.data_vencimento)}</p>
                    </>
                  )}
                  <p className="text-[10px] text-muted-foreground leading-tight">{cardFaturas.length} fat.</p>
                </div>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t bg-muted/20">
                  {cardFaturas.length === 0 ? (
                    <p className="px-6 py-4 text-sm text-muted-foreground">Nenhuma fatura cadastrada</p>
                  ) : (
                    cardFaturas.map(fat => {
                      const fatLancs = getFaturaLancamentos(fat.id);
                      const isFatExpanded = expandedFatura === fat.id;
                      const pagamentos = fatLancs.filter(l => isPagamentoFatura(l));
                      const validos = fatLancs.filter(l => !l.observacao?.includes('Não faz parte') && !isPagamentoFatura(l));
                      const despesasParaTabela = fatLancs.filter(l => !isPagamentoFatura(l));
                      const totalEmp = validos.filter(l => l.natureza === 'empresarial').reduce((s, l) => s + (l.valor || 0), 0);
                      const totalPes = validos.filter(l => l.natureza === 'pessoal').reduce((s, l) => s + (l.valor || 0), 0);
                      const totalPagamentos = pagamentos.reduce((s, l) => s + (l.valor || 0), 0);

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
                              {(() => {
                                const url = getFaturaFileUrl(fat);
                                if (!url) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setViewerFile({ url, titulo: `${c.nome} — ${fat.mes_referencia}` }); }}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                    title="Ver fatura original importada"
                                  >
                                    <FileImage className="w-3 h-3" /> Ver original
                                  </button>
                                );
                              })()}
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

                                  <CategoriaBreakdown lancamentos={validos} />

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
                                        {despesasParaTabela.map(l => {
                                          const isExcluded = l.observacao?.includes('Não faz parte');
                                          const editingCat = editingLanc?.id === l.id && editingLanc?.field === 'categoria';
                                          const editingNat = editingLanc?.id === l.id && editingLanc?.field === 'natureza';
                                          return (
                                            <tr key={l.id} className={`border-b last:border-b-0 ${isExcluded ? 'opacity-40' : ''}`}>
                                              <td className="py-1.5 whitespace-nowrap">{formatDate(l.data_lancamento)}</td>
                                              <td className="py-1.5 max-w-[180px] truncate" title={l.estabelecimento}>
                                                {l.estabelecimento}
                                                {isExcluded && <span className="ml-1 text-[9px] text-red-500 font-semibold">(não contabilizado)</span>}
                                              </td>
                                              <td className="py-1.5">
                                                {editingCat ? (
                                                  <Select
                                                    value={l.categoria || ''}
                                                    onValueChange={async v => {
                                                      await base44.entities.LancamentoCartao.update(l.id, { categoria: v });
                                                      setEditingLanc(null);
                                                      loadData();
                                                    }}
                                                    open
                                                    onOpenChange={open => { if (!open) setEditingLanc(null); }}
                                                  >
                                                    <SelectTrigger className="h-6 text-[10px] px-1.5 w-[130px]">
                                                      <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {Object.entries(categoriaLabels).map(([k, v]) => (
                                                        <SelectItem key={k} value={k}>{v}</SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                ) : (
                                                  <span
                                                    onClick={() => setEditingLanc({ id: l.id, field: 'categoria' })}
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer hover:opacity-75 transition-opacity ${categoriaColors[l.categoria] || 'bg-slate-100 text-slate-700'}`}
                                                    title="Clique para editar"
                                                  >
                                                    {categoriaLabels[l.categoria] || l.categoria || '—'}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-1.5">
                                                {editingNat ? (
                                                  <Select
                                                    value={l.natureza || ''}
                                                    onValueChange={async v => {
                                                      await base44.entities.LancamentoCartao.update(l.id, { natureza: v });
                                                      setEditingLanc(null);
                                                      loadData();
                                                    }}
                                                    open
                                                    onOpenChange={open => { if (!open) setEditingLanc(null); }}
                                                  >
                                                    <SelectTrigger className="h-6 text-[10px] px-1.5 w-[110px]">
                                                      <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="empresarial">empresarial</SelectItem>
                                                      <SelectItem value="pessoal">pessoal</SelectItem>
                                                      <SelectItem value="reembolso">reembolso</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                ) : (
                                                  <span
                                                    onClick={() => setEditingLanc({ id: l.id, field: 'natureza' })}
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer hover:opacity-75 transition-opacity ${l.natureza === 'empresarial' ? 'bg-blue-100 text-blue-700' : l.natureza === 'reembolso' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}
                                                    title="Clique para editar"
                                                  >
                                                    {l.natureza || '—'}
                                                  </span>
                                                )}
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

                                  {pagamentos.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-dashed">
                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                        Pagamentos da fatura anterior · não contabilizados
                                      </p>
                                      <table className="w-full text-xs text-muted-foreground/70">
                                        <tbody>
                                          {pagamentos.map(l => (
                                            <tr key={l.id} className="border-b last:border-b-0">
                                              <td className="py-1 whitespace-nowrap w-24">{formatDate(l.data_lancamento)}</td>
                                              <td className="py-1 italic" title={l.estabelecimento}>{l.estabelecimento}</td>
                                              <td className="py-1 text-right tabular-nums">{formatCurrency(l.valor)}</td>
                                            </tr>
                                          ))}
                                          <tr>
                                            <td colSpan={2} className="py-1.5 text-right font-semibold uppercase text-[10px] tracking-wider">Total pagamentos</td>
                                            <td className="py-1.5 text-right font-bold tabular-nums">{formatCurrency(totalPagamentos)}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
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

      <FaturaImageViewer
        open={!!viewerFile}
        onOpenChange={(v) => { if (!v) setViewerFile(null); }}
        fileUrl={viewerFile?.url}
        titulo={viewerFile?.titulo}
      />

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