import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Package, Building2, Search, XIcon, Plus, ChevronRight, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PageHeader from '../components/shared/PageHeader';
import BannerCentralCompras from '../components/produtos/BannerCentralCompras';
import { buscarComprasCentral } from '@/functions/buscarComprasCentral';
import { formatCurrency, formatDate } from '../lib/formatters';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const categoriaOptions = ['notebook','tablet','smartphone','componente','memoria','armazenamento','periferico','software','rede','outro'];
const categoriaColors = {
  notebook: 'bg-blue-100 text-blue-700', tablet: 'bg-purple-100 text-purple-700',
  smartphone: 'bg-green-100 text-green-700', componente: 'bg-orange-100 text-orange-700',
  memoria: 'bg-yellow-100 text-yellow-700', armazenamento: 'bg-cyan-100 text-cyan-700',
  periferico: 'bg-pink-100 text-pink-700', software: 'bg-indigo-100 text-indigo-700',
  rede: 'bg-teal-100 text-teal-700', outro: 'bg-slate-100 text-slate-700',
};
const fornCategColors = {
  distribuidor: 'bg-blue-100 text-blue-700', marketplace: 'bg-purple-100 text-purple-700',
  transportadora: 'bg-orange-100 text-orange-700', servico: 'bg-green-100 text-green-700',
  material: 'bg-yellow-100 text-yellow-700', outro: 'bg-slate-100 text-slate-700',
};

const FORN_FORM_INIT = { nome: '', cnpj: '', categoria: 'distribuidor', contato: '', prazo_medio_entrega: '', condicao_pagamento: '', observacoes: '', is_ativo: true };

export default function ProdutosFornecedores() {
  const [activeTab, setActiveTab] = useState('produtos');
  const [compras, setCompras] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusCentral, setStatusCentral] = useState(null);
  const [fornLive, setFornLive] = useState([]);

  // Produto filters
  const [searchProd, setSearchProd] = useState('');
  const [filterForn, setFilterForn] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');

  // Painel histórico
  const [selectedProd, setSelectedProd] = useState(null);

  // Fornecedor form
  const [showFornForm, setShowFornForm] = useState(false);
  const [fornForm, setFornForm] = useState(FORN_FORM_INIT);

  async function loadAll() {
    setLoading(true);
    const [res, f] = await Promise.all([
      buscarComprasCentral({}),
      base44.entities.Fornecedor.list('nome', 200),
    ]);
    const d = res.data || {};
    setStatusCentral(d);
    setCompras(d.itens || []);
    setFornLive(d.fornecedores || []);
    setFornecedores(f);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // Fornecedores únicos em ItemCompra
  const fornUnicosCompra = useMemo(() => [...new Set(compras.map(c => c.fornecedor).filter(Boolean))].sort(), [compras]);

  // Filtrar produtos
  const filteredCompras = useMemo(() => {
    return compras.filter(c => {
      if (searchProd && !c.descricao_produto?.toLowerCase().includes(searchProd.toLowerCase())) return false;
      if (filterForn !== 'all' && c.fornecedor !== filterForn) return false;
      if (filterCat !== 'all' && c.categoria_produto !== filterCat) return false;
      if (periodoInicio && c.data_emissao < periodoInicio) return false;
      if (periodoFim && c.data_emissao > periodoFim) return false;
      return true;
    });
  }, [compras, searchProd, filterForn, filterCat, periodoInicio, periodoFim]);

  // Cards resumo
  const totalComprado = filteredCompras.reduce((s, c) => s + (c.valor_total || 0), 0);
  const qtdItens = filteredCompras.reduce((s, c) => s + (c.quantidade || 1), 0);

  const fornMaisUsado = useMemo(() => {
    const t = {};
    filteredCompras.forEach(c => { if (c.fornecedor) t[c.fornecedor] = (t[c.fornecedor] || 0) + (c.valor_total || 0); });
    return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }, [filteredCompras]);

  const prodMaisComprado = useMemo(() => {
    const t = {};
    filteredCompras.forEach(c => { if (c.descricao_produto) t[c.descricao_produto] = (t[c.descricao_produto] || 0) + (c.quantidade || 1); });
    return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }, [filteredCompras]);

  // Histórico preço do produto selecionado
  const historicoPreco = useMemo(() => {
    if (!selectedProd) return [];
    const termo = selectedProd.descricao_produto?.toLowerCase() || '';
    return compras
      .filter(c => c.descricao_produto?.toLowerCase().includes(termo.split(' ')[0]))
      .filter(c => c.valor_unitario)
      .sort((a, b) => a.data_emissao > b.data_emissao ? 1 : -1)
      .map(c => ({ data: formatDate(c.data_emissao), preco: c.valor_unitario, fornecedor: c.fornecedor }));
  }, [selectedProd, compras]);

  // Ranking fornecedores
  const rankingForn = useMemo(() => {
    const t = {};
    compras.forEach(c => {
      const d = c.data_emissao || '';
      if (periodoInicio && d < periodoInicio) return;
      if (periodoFim && d > periodoFim) return;
      if (c.fornecedor) t[c.fornecedor] = (t[c.fornecedor] || 0) + (c.valor_total || 0);
    });
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, [compras, periodoInicio, periodoFim]);
  const maxRank = rankingForn[0]?.[1] || 1;

  // Agregados live indexados por nome normalizado
  const aggLive = useMemo(() => {
    const m = {};
    fornLive.forEach(f => { m[(f.nome || '').toLowerCase().trim()] = f; });
    return m;
  }, [fornLive]);

  // Fornecedores locais + os da Central que não estão cadastrados aqui
  const listaFornecedores = useMemo(() => {
    const cadastrados = fornecedores.map(f => ({
      ...f,
      _total: aggLive[(f.nome || '').toLowerCase().trim()]?.total || 0,
      _qtd: aggLive[(f.nome || '').toLowerCase().trim()]?.pedidos || 0,
    }));
    const nomesLocais = new Set(fornecedores.map(f => (f.nome || '').toLowerCase().trim()));
    const somenteCentral = fornLive
      .filter(f => !nomesLocais.has((f.nome || '').toLowerCase().trim()))
      .map(f => ({ id: `central-${f.nome}`, nome: f.nome, _total: f.total, _qtd: f.pedidos, _daCentral: true }));
    return [...cadastrados, ...somenteCentral];
  }, [fornecedores, fornLive, aggLive]);

  async function handleSaveForn(e) {
    e.preventDefault();
    await base44.entities.Fornecedor.create({
      ...fornForm,
      prazo_medio_entrega: fornForm.prazo_medio_entrega ? parseInt(fornForm.prazo_medio_entrega) : undefined,
    });
    setShowFornForm(false);
    setFornForm(FORN_FORM_INIT);
    loadAll();
  }

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Produtos & Fornecedores" subtitle="Histórico de compras e gestão de fornecedores">
        <Button onClick={() => { setActiveTab('fornecedores'); setShowFornForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </Button>
      </PageHeader>

      <BannerCentralCompras status={statusCentral} onRetry={loadAll} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="produtos" className="gap-2"><Package className="w-4 h-4" />Busca de Produtos</TabsTrigger>
          <TabsTrigger value="fornecedores" className="gap-2"><Building2 className="w-4 h-4" />Fornecedores</TabsTrigger>
        </TabsList>

        {/* ABA PRODUTOS */}
        <TabsContent value="produtos">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={searchProd} onChange={e => setSearchProd(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterForn} onValueChange={setFilterForn}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos fornecedores</SelectItem>
                {fornUnicosCompra.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categoriaOptions.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" placeholder="De" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className="w-[140px]" />
              <span className="text-muted-foreground text-sm">–</span>
              <Input type="date" placeholder="Até" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className="w-[140px]" />
            </div>
          </div>

          {/* Cards resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-card border rounded-xl p-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Total Comprado</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalComprado)}</p>
            </div>
            <div className="bg-card border rounded-xl p-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Qtd. Itens</p>
              <p className="text-xl font-bold">{qtdItens}</p>
              <p className="text-xs text-muted-foreground">{filteredCompras.length} linhas</p>
            </div>
            <div className="bg-card border rounded-xl p-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Maior Fornecedor (R$)</p>
              <p className="text-sm font-bold leading-tight">{fornMaisUsado}</p>
            </div>
            <div className="bg-card border rounded-xl p-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Produto Mais Comprado</p>
              <p className="text-xs font-bold leading-tight line-clamp-2">{prodMaisComprado}</p>
            </div>
          </div>

          {/* Layout principal: tabela + painel lateral */}
          <div className="flex gap-4">
            {/* Tabela */}
            <div className={`bg-card rounded-xl border overflow-hidden ${selectedProd ? 'flex-1 min-w-0' : 'w-full'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gradient-to-r from-muted/60 to-muted/30">
                      <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Data</th>
                      <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Produto</th>
                      <th className="hidden md:table-cell text-left px-3 py-3 font-semibold text-muted-foreground">Fornecedor</th>
                      <th className="hidden sm:table-cell text-left px-3 py-3 font-semibold text-muted-foreground">Cat.</th>
                      <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Qtd</th>
                      <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Unit.</th>
                      <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Total</th>
                      <th className="hidden lg:table-cell text-left px-3 py-3 font-semibold text-muted-foreground">NF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                    ) : filteredCompras.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhum produto encontrado</td></tr>
                    ) : filteredCompras.map(c => (
                      <tr
                        key={c.id}
                        className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${selectedProd?.id === c.id ? 'bg-primary/5' : ''}`}
                        onClick={() => setSelectedProd(selectedProd?.id === c.id ? null : c)}
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">{formatDate(c.data_emissao)}</td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <p className="font-medium text-xs leading-tight line-clamp-2">{c.descricao_produto}</p>
                        </td>
                        <td className="hidden md:table-cell px-3 py-2.5 text-xs text-muted-foreground">{c.fornecedor}</td>
                        <td className="hidden sm:table-cell px-3 py-2.5">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${categoriaColors[c.categoria_produto] || 'bg-slate-100 text-slate-700'}`}>
                            {c.categoria_produto}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-xs">{c.quantidade}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-xs">{c.valor_unitario ? formatCurrency(c.valor_unitario) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-xs text-red-600">{formatCurrency(c.valor_total)}</td>
                        <td className="hidden lg:table-cell px-3 py-2.5 text-xs text-muted-foreground">{c.numero_nota || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Painel histórico */}
            {selectedProd && (
              <div className="w-[340px] shrink-0 bg-card border rounded-xl p-4 space-y-3 self-start sticky top-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase">Histórico de Preço</p>
                    <p className="text-sm font-medium leading-tight mt-0.5 line-clamp-2">{selectedProd.descricao_produto}</p>
                  </div>
                  <button onClick={() => setSelectedProd(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
                {historicoPreco.length < 2 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Dados insuficientes para gráfico</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={historicoPreco} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => formatCurrency(v)} />
                      <Line type="monotone" dataKey="preco" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {historicoPreco.map((h, i) => (
                    <div key={i} className="flex justify-between items-center text-xs border-b pb-1">
                      <span className="text-muted-foreground">{h.data}</span>
                      <span className="text-xs text-muted-foreground truncate mx-2">{h.fornecedor}</span>
                      <span className="font-semibold">{formatCurrency(h.preco)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA FORNECEDORES */}
        <TabsContent value="fornecedores">
          {/* Ranking */}
          {rankingForn.length > 0 && (
            <div className="bg-card border rounded-xl p-4 mb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Ranking por Volume (R$)</p>
              <div className="space-y-2">
                {rankingForn.slice(0, 8).map(([nome, val]) => (
                  <div key={nome} className="flex items-center gap-3">
                    <span className="text-xs w-36 truncate shrink-0">{nome}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(val / maxRank) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-24 text-right tabular-nums">{formatCurrency(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cards fornecedores */}
          {loading ? (
            <p className="text-center py-12 text-muted-foreground">Carregando...</p>
          ) : listaFornecedores.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-2xl text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum fornecedor cadastrado</p>
              <Button className="mt-4 gap-2" onClick={() => setShowFornForm(true)}><Plus className="w-4 h-4" />Adicionar Fornecedor</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listaFornecedores.map(f => {
                const total = f._total;
                const qtd = f._qtd;
                return (
                  <div key={f.id} className="bg-card border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{f.nome}</p>
                        {f.cnpj && <p className="text-xs text-muted-foreground">{f.cnpj}</p>}
                      </div>
                      {f._daCentral ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 bg-sky-100 text-sky-700">Central</span>
                      ) : (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${f.is_ativo !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {f.is_ativo !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {f.categoria && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fornCategColors[f.categoria] || 'bg-slate-100 text-slate-700'}`}>
                          {f.categoria}
                        </span>
                      )}
                      {f.condicao_pagamento && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{f.condicao_pagamento}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Comprado</p>
                        <p className="font-bold text-sm text-red-600">{formatCurrency(total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nº Pedidos</p>
                        <p className="font-bold text-sm">{qtd}</p>
                      </div>
                    </div>
                    {f.contato && <p className="text-xs text-muted-foreground">📞 {f.contato}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Novo Fornecedor */}
      <Dialog open={showFornForm} onOpenChange={setShowFornForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveForn} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Nome *</Label><Input value={fornForm.nome} onChange={e => setFornForm({...fornForm, nome: e.target.value})} required /></div>
              <div><Label>CNPJ</Label><Input value={fornForm.cnpj} onChange={e => setFornForm({...fornForm, cnpj: e.target.value})} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={fornForm.categoria} onValueChange={v => setFornForm({...fornForm, categoria: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['distribuidor','marketplace','transportadora','servico','material','outro'].map(c =>
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Contato</Label><Input value={fornForm.contato} onChange={e => setFornForm({...fornForm, contato: e.target.value})} /></div>
              <div><Label>Prazo Entrega (dias)</Label><Input type="number" value={fornForm.prazo_medio_entrega} onChange={e => setFornForm({...fornForm, prazo_medio_entrega: e.target.value})} /></div>
              <div className="col-span-2"><Label>Condição de Pagamento</Label><Input placeholder="Ex: 30 dias, à vista" value={fornForm.condicao_pagamento} onChange={e => setFornForm({...fornForm, condicao_pagamento: e.target.value})} /></div>
              <div className="col-span-2"><Label>Observações</Label><Input value={fornForm.observacoes} onChange={e => setFornForm({...fornForm, observacoes: e.target.value})} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ativo" checked={fornForm.is_ativo} onChange={e => setFornForm({...fornForm, is_ativo: e.target.checked})} />
              <Label htmlFor="ativo">Fornecedor ativo</Label>
            </div>
            <Button type="submit" className="w-full">Salvar Fornecedor</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}