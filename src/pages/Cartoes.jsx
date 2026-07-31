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
import DeduplicarCartoesButton from '../components/cartoes/DeduplicarCartoesButton';
import ReparoCartoesButton from '../components/cartoes/ReparoCartoesButton';
import FaturaImageViewer from '../components/cartoes/FaturaImageViewer';
import CartaoCalendarioCard from '../components/cartoes/CartaoCalendarioCard';
import LancamentosEditableTable from '../components/cartoes/LancamentosEditableTable';
import ReanalisarFaturaButton from '../components/cartoes/ReanalisarFaturaButton';
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
{ nome: 'Magalu / LuizaCred', bandeira: 'Magalu', titular: 'pessoal', tipo: 'pessoal', dia_vencimento: 27, empresa_vinculada: 'pessoal', conta_bancaria_pagamento: 'Sicredi 36092-2', is_ativo: true }];


const categoriaLabels = {
  alimentacao: 'Alimentação', combustivel: 'Combustível', lazer: 'Lazer',
  tecnologia: 'Tecnologia', servico_pessoal: 'Serviço Pessoal', saude_bem_estar: 'Saúde/Bem-Estar',
  beleza: 'Beleza', farmacia: 'Farmácia', transporte: 'Transporte',
  financeiro: 'Financeiro', seguro: 'Seguro',
  produtos: 'Produtos', estoque: 'Estoque',
  outro: 'Outro'
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
  outro: 'bg-amber-100 text-amber-700'
};

// Estilo por bandeira/banco — cor própria de cada instituição
const BANDEIRAS = {
  Sicoob: { bar: 'bg-teal-700', icon: 'bg-teal-700 text-white', badge: 'bg-teal-100 text-teal-800', nameText: 'text-teal-800' },
  Sicredi: { bar: 'bg-green-600', icon: 'bg-green-600 text-white', badge: 'bg-green-100 text-green-800', nameText: 'text-green-700' },
  Acentra: { bar: 'bg-orange-500', icon: 'bg-orange-500 text-white', badge: 'bg-orange-100 text-orange-800', nameText: 'text-orange-700' },
  Magalu: { bar: 'bg-blue-600', icon: 'bg-blue-600 text-white', badge: 'bg-blue-100 text-blue-800', nameText: 'text-blue-700' },
  default: { bar: 'bg-slate-500', icon: 'bg-slate-600 text-white', badge: 'bg-slate-100 text-slate-700', nameText: 'text-slate-800' }
};

function CategoriaBreakdown({ lancamentos }) {
  const validos = lancamentos.filter((l) => !l.observacao?.includes('Não faz parte') && !isPagamentoFatura(l));
  const cats = {};
  validos.forEach((l) => {
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
        {sorted.map(([cat, val]) =>
        <div key={cat} className="flex items-center justify-between bg-background rounded-md px-2 py-1.5 border">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${categoriaColors[cat] || 'bg-slate-100 text-slate-700'}`}>
                {categoriaLabels[cat] || cat}
              </span>
            </div>
            <div className="text-right ml-1 shrink-0">
              <p className="text-xs font-bold">{formatCurrency(val)}</p>
              <p className="text-[10px] text-muted-foreground">{total > 0 ? (val / total * 100).toFixed(0) : 0}%</p>
            </div>
          </div>
        )}
      </div>
    </div>);

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

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    let cards = await base44.entities.ContaCartao.list();
    if (cards.length === 0) {
      await base44.entities.ContaCartao.bulkCreate(SEED_CARDS);
      cards = await base44.entities.ContaCartao.list();
    }
    const [fats, lancs, batches] = await Promise.all([
    base44.entities.FaturaCartao.list('-data_vencimento', 200),
    base44.entities.LancamentoCartao.list('-data_lancamento', 1000),
    base44.entities.ImportBatch.filter({ batch_type: 'fatura_cartao', status: 'completed' }, '-created_date', 200).catch(() => [])]
    );
    setCartoes(cards.sort((a, b) => (a.dia_vencimento || 0) - (b.dia_vencimento || 0)));
    setFaturas(fats);
    setLancamentos(lancs);
    setImportBatches(batches || []);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    loadData();
    let timer = null;
    const debouncedLoad = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loadData(true), 3000);
    };
    window.addEventListener('neuralfinRefresh', debouncedLoad);
    const unsubFat = base44.entities.FaturaCartao.subscribe(debouncedLoad);
    const unsubLanc = base44.entities.LancamentoCartao.subscribe(debouncedLoad);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('neuralfinRefresh', debouncedLoad);
      unsubFat();
      unsubLanc();
    };
  }, []);

  async function handleFaturaSubmit(e) {
    e.preventDefault();
    await base44.entities.FaturaCartao.create({
      ...faturaForm,
      valor_total: parseFloat(faturaForm.valor_total),
      valor_pago: faturaForm.valor_pago ? parseFloat(faturaForm.valor_pago) : 0
    });
    setShowFaturaForm(false);
    setFaturaForm({ conta_cartao_id: '', mes_referencia: '', data_vencimento: '', valor_total: '', status: 'aberta', data_pagamento: '', valor_pago: '0' });
    loadData();
  }

  const monthTotals = useMemo(() => {
    const t = {};
    ALL_MONTHS.forEach((m) => {
      t[m] = faturas.filter((f) => f.mes_referencia === m).reduce((s, f) => s + (f.valor_total || 0), 0);
    });
    return t;
  }, [faturas]);

  const filteredFaturas = useMemo(() => {
    if (isAnnual) return faturas;
    return faturas.filter((f) => f.mes_referencia === selectedMonth);
  }, [faturas, selectedMonth, isAnnual]);

  // Agrupa cartões duplicados (mesmo nome criado por usuários diferentes) — soma faturas de todos os ids
  const cartoesAgrupados = useMemo(() => {
    const map = new Map();
    for (const c of cartoes) {
      const key = (c.nome || '').trim();
      if (!map.has(key)) {
        map.set(key, { ...c, ids: [c.id] });
      } else {
        map.get(key).ids.push(c.id);
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.dia_vencimento || 0) - (b.dia_vencimento || 0));
  }, [cartoes]);

  function getCardFaturas(cardIdOrIds) {
    const ids = Array.isArray(cardIdOrIds) ? cardIdOrIds : [cardIdOrIds];
    return filteredFaturas.filter((f) => ids.includes(f.conta_cartao_id)).sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento));
  }

  function getFaturaLancamentos(faturaId) {
    // Fonte única: TODOS os lançamentos da fatura no banco, sem descartar nenhum.
    // (Dedup real deve ser feito pelo botão "Deduplicar", não escondendo lançamentos aqui —
    // esconder fazia a lista "faltar" itens e não fechar com a fatura.)
    return lancamentos.
    filter((l) => l.fatura_id === faturaId).
    sort((a, b) => new Date(a.data_lancamento) - new Date(b.data_lancamento));
  }

  // Localiza o arquivo PDF/imagem importado para uma fatura específica
  function getFaturaFileUrl(fat) {
    const cartao = cartoes.find((c) => c.id === fat.conta_cartao_id);
    const nomeCart = (cartao?.nome || '').split('—')[0].trim().toLowerCase();
    for (const b of importBatches) {
      if (!b.notes) continue;
      let n;
      try {n = JSON.parse(b.notes);} catch {continue;}
      if (!n?.file_url) continue;
      const matchValor = n.valor_total != null && Math.abs(n.valor_total - (fat.valor_total || 0)) < 1;
      const matchVenc = n.data_vencimento && n.data_vencimento === fat.data_vencimento;
      const matchCart = nomeCart && n.nome_cartao && n.nome_cartao.toLowerCase().includes(nomeCart);
      if (matchValor && matchVenc || matchCart && matchVenc || matchCart && matchValor) {
        return n.file_url;
      }
    }
    return null;
  }

  function getLatestFatura(cardIdOrIds) {
    return getCardFaturas(cardIdOrIds)[0] || null;
  }

  // Última fatura REAL do cartão (todos os meses) — usado no Calendário de Vencimentos,
  // que é uma visão geral e não deve depender do mês selecionado.
  function getUltimaFaturaGeral(cardIdOrIds) {
    const ids = Array.isArray(cardIdOrIds) ? cardIdOrIds : [cardIdOrIds];
    return faturas.
    filter((f) => ids.includes(f.conta_cartao_id)).
    sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento))[0] || null;
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>);


  // Fonte única de verdade: o total vem SEMPRE da soma dos lançamentos no banco
  // (com sinal, incluindo estornos), nunca do campo valor_total armazenado — que pode estar desatualizado.
  const faturaIdsMes = new Set(filteredFaturas.map((f) => f.id));
  const totalMes = lancamentos.
  filter((l) => faturaIdsMes.has(l.fatura_id)).
  reduce((s, l) => s + (l.valor || 0), 0);
  const totalPagoMes = filteredFaturas.filter((f) => f.status === 'paga_total').reduce((s, f) => s + (f.valor_pago || 0), 0);

  return (
    <div className="lg:px-6 lg:py-6 max-w-[1600px] mx-auto px-4 py-1">
      <PageHeader title="Cartões de Crédito" subtitle={`${cartoesAgrupados.length} cartões cadastrados`}>
        <MonthNavigator
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          isAnnual={isAnnual}
          onToggleAnnual={() => setIsAnnual(!isAnnual)}
          monthTotals={monthTotals} />
        
        <DeduplicarCartoesButton onDone={loadData} />
        <ReparoCartoesButton onComplete={loadData} />
        <ConciliarFaturasButton onDone={loadData} />
        <Button onClick={() => setShowFaturaForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova Fatura</Button>
      </PageHeader>

      {/* Resumo do mês */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <GradientCard title="Total Faturas" value={formatCurrency(totalMes)} sub={`${filteredFaturas.length} faturas`} icon={CreditCard} gradient="purple" />
        <GradientCard title="Total Pago" value={formatCurrency(totalPagoMes)} sub="Faturas quitadas" icon={DollarSign} gradient="green" />
        <GradientCard title="A Pagar" value={formatCurrency(totalMes - totalPagoMes)} sub="Saldo restante" icon={AlertCircle} gradient="orange" />
        <GradientCard title="Cartões Ativos" value={cartoes.filter((c) => c.is_ativo).length} sub={`${cartoes.length} cadastrados`} icon={CreditCard} gradient="blue" />
      </div>

      {/* Calendário de Vencimentos — cada tópico com o círculo do dia no topo e o card do cartão logo abaixo */}
      <div className="bg-card rounded-xl border p-5 mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Calendário de Vencimentos
        </p>
        <div className="flex gap-3 items-start overflow-x-auto pb-2">
          {cartoesAgrupados.map((c) => {
            const cardFaturas = getCardFaturas(c.ids);
            const latestFat = cardFaturas[0] || getUltimaFaturaGeral(c.ids);
            const url = latestFat ? getFaturaFileUrl(latestFat) : null;
            const faturasCount = cardFaturas.length || faturas.filter((f) => c.ids.includes(f.conta_cartao_id)).length;
            return (
              <CartaoCalendarioCard
                key={c.id}
                cartao={c}
                latestFat={latestFat}
                fileUrl={url}
                faturasCount={faturasCount}
                isExpanded={expandedCard === c.id}
                onToggle={() => {
                  if (expandedCard === c.id) {
                    setExpandedCard(null);
                    setExpandedFatura(null);
                  } else {
                    setExpandedCard(c.id);
                    const firstFat = getCardFaturas(c.ids)[0];
                    if (firstFat) setExpandedFatura(firstFat.id);
                  }
                }}
                onViewFile={setViewerFile} />);


          })}
        </div>
      </div>

      {/* Conciliação */}
      {filteredFaturas.length > 0 &&
      <ConciliacaoCartoes
        lancamentos={lancamentos.filter((l) =>
        l.fatura_id &&
        faturas.find((f) => f.id === l.fatura_id && (isAnnual || f.mes_referencia === selectedMonth))
        )}
        selectedMonth={selectedMonth}
        isAnnual={isAnnual}
        totalFaturas={totalMes} />

      }

      {/* Painel expandido — largura total na quebra abaixo */}
      {expandedCard && (() => {
        const c = cartoesAgrupados.find((x) => x.id === expandedCard);
        if (!c) return null;
        const cardFaturas = getCardFaturas(c.ids);
        return (
          <div className="mt-4 bg-card rounded-xl border overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <CreditCard className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-bold truncate">{c.nome}</span>
                <span className="text-[10px] text-muted-foreground truncate">{c.bandeira} · dia {c.dia_vencimento} · {c.conta_bancaria_pagamento}</span>
              </div>
              <button
                onClick={() => {setExpandedCard(null);setExpandedFatura(null);}}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted">
                
                Fechar ✕
              </button>
            </div>
            <div className="bg-muted/10">
              {cardFaturas.length === 0 ?
              <p className="px-6 py-4 text-sm text-muted-foreground">Nenhuma fatura cadastrada</p> :

              cardFaturas.map((fat) => {
                const fatLancs = getFaturaLancamentos(fat.id);
                const isFatExpanded = expandedFatura === fat.id;
                const pagamentos = fatLancs.filter((l) => isPagamentoFatura(l));
                const validos = fatLancs.filter((l) => !l.observacao?.includes('Não faz parte') && !isPagamentoFatura(l));
                const despesasParaTabela = fatLancs.filter((l) => !isPagamentoFatura(l));
                const totalEmp = validos.filter((l) => l.natureza === 'empresarial').reduce((s, l) => s + (l.valor || 0), 0);
                const totalPes = validos.filter((l) => l.natureza === 'pessoal').reduce((s, l) => s + (l.valor || 0), 0);
                const totalPagamentos = pagamentos.reduce((s, l) => s + (l.valor || 0), 0);
                // Total da fatura = soma dos lançamentos no banco (fonte única de verdade)
                const totalFaturaReal = fatLancs.reduce((s, l) => s + (l.valor || 0), 0);

                return (
                  <div key={fat.id} className="border-b last:border-b-0">
                      <button
                      onClick={() => setExpandedFatura(isFatExpanded ? null : fat.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 text-left transition-colors">
                      
                        <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold">{fat.mes_referencia}</span>
                          <StatusBadge status={fat.status} />
                          <span className="text-[10px] text-muted-foreground">Venc. {formatDate(fat.data_vencimento)}</span>
                          {fatLancs.length > 0 && <span className="text-[10px] text-muted-foreground">{fatLancs.length} lanç.</span>}
                          {(() => {
                          const url2 = getFaturaFileUrl(fat);
                          if (!url2) return null;
                          return (
                            <button
                              type="button"
                              onClick={(e) => {e.stopPropagation();setViewerFile({ url: url2, titulo: `${c.nome} — ${fat.mes_referencia}` });}}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                              title="Ver fatura original importada">
                              
                                <FileImage className="w-3 h-3" /> Ver original
                              </button>);

                        })()}
                          <ReanalisarFaturaButton faturaId={fat.id} titulo={`${c.nome} — ${fat.mes_referencia}`} />
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold">{formatCurrency(totalFaturaReal)}</span>
                          {fat.valor_pago > 0 && <p className="text-[10px] text-green-600 leading-tight">Pago: {formatCurrency(fat.valor_pago)}</p>}
                        </div>
                        {isFatExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                      </button>

                      {isFatExpanded &&
                    <div className="px-3 pb-3 bg-background">
                          {fatLancs.length === 0 ?
                      <p className="text-xs text-muted-foreground py-2">Nenhum lançamento cadastrado</p> :

                      <>
                              <div className="flex gap-1.5 mt-2 mb-2">
                                <div className="bg-blue-50 border border-blue-100 rounded px-2 py-1 text-[10px] flex-1">
                                  <p className="text-blue-600 font-semibold">Empresarial</p>
                                  <p className="font-bold text-blue-800 text-xs">{formatCurrency(totalEmp)}</p>
                                </div>
                                <div className="bg-purple-50 border border-purple-100 rounded px-2 py-1 text-[10px] flex-1">
                                  <p className="text-purple-600 font-semibold">Pessoal</p>
                                  <p className="font-bold text-purple-800 text-xs">{formatCurrency(totalPes)}</p>
                                </div>
                                <div className="bg-muted border rounded px-2 py-1 text-[10px] flex-1">
                                  <p className="text-muted-foreground font-semibold">Total</p>
                                  <p className="font-bold text-xs">{formatCurrency(totalFaturaReal)}</p>
                                </div>
                              </div>

                              <CategoriaBreakdown lancamentos={validos} />

                              <div className="mt-4">
                                <LancamentosEditableTable lancamentos={despesasParaTabela} onReload={loadData} />
                              </div>

                              {pagamentos.length > 0 &&
                        <div className="mt-4 pt-3 border-t border-dashed">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Pagamentos da fatura anterior · não contabilizados
                                  </p>
                                  <table className="w-full text-xs text-muted-foreground/70">
                                    <tbody>
                                      {pagamentos.map((l) =>
                              <tr key={l.id} className="border-b last:border-b-0">
                                          <td className="py-1 whitespace-nowrap w-24">{formatDate(l.data_lancamento)}</td>
                                          <td className="py-1 italic" title={l.estabelecimento}>{l.estabelecimento}</td>
                                          <td className="py-1 text-right tabular-nums">{formatCurrency(l.valor)}</td>
                                        </tr>
                              )}
                                      <tr>
                                        <td colSpan={2} className="py-1.5 text-right font-semibold uppercase text-[10px] tracking-wider">Total pagamentos</td>
                                        <td className="py-1.5 text-right font-bold tabular-nums">{formatCurrency(totalPagamentos)}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                        }
                            </>
                      }
                        </div>
                    }
                    </div>);

              })
              }
            </div>
          </div>);

      })()}

      <FaturaImageViewer
        open={!!viewerFile}
        onOpenChange={(v) => {if (!v) setViewerFile(null);}}
        fileUrl={viewerFile?.url}
        titulo={viewerFile?.titulo} />
      

      {/* Fatura Form */}
      <Dialog open={showFaturaForm} onOpenChange={setShowFaturaForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Fatura</DialogTitle></DialogHeader>
          <form onSubmit={handleFaturaSubmit} className="space-y-4">
            <div>
              <Label>Cartão</Label>
              <Select value={faturaForm.conta_cartao_id} onValueChange={(v) => setFaturaForm({ ...faturaForm, conta_cartao_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mês Referência</Label><Input placeholder="2026-03" value={faturaForm.mes_referencia} onChange={(e) => setFaturaForm({ ...faturaForm, mes_referencia: e.target.value })} required /></div>
              <div><Label>Data Vencimento</Label><Input type="date" value={faturaForm.data_vencimento} onChange={(e) => setFaturaForm({ ...faturaForm, data_vencimento: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor Total</Label><Input type="number" step="0.01" value={faturaForm.valor_total} onChange={(e) => setFaturaForm({ ...faturaForm, valor_total: e.target.value })} required /></div>
              <div>
                <Label>Status</Label>
                <Select value={faturaForm.status} onValueChange={(v) => setFaturaForm({ ...faturaForm, status: v })}>
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
              <div><Label>Data Pagamento</Label><Input type="date" value={faturaForm.data_pagamento} onChange={(e) => setFaturaForm({ ...faturaForm, data_pagamento: e.target.value })} /></div>
              <div><Label>Valor Pago</Label><Input type="number" step="0.01" value={faturaForm.valor_pago} onChange={(e) => setFaturaForm({ ...faturaForm, valor_pago: e.target.value })} /></div>
            </div>
            <Button type="submit" className="w-full">Salvar Fatura</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

}