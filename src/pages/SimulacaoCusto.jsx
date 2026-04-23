import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { FlaskConical, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '../components/shared/PageHeader';
import SeletorSKU from '../components/simulacao/SeletorSKU';
import DRESimuladoCard from '../components/simulacao/DRESimuladoCard';
import GraficoHistoricoCusto from '../components/simulacao/GraficoHistoricoCusto';
import { agruparProdutosNFe, calcularCustoEfetivo, serieHistoricaCusto } from '../lib/custoSimulacaoEngine';
import { formatCurrency } from '../lib/formatters';

export default function SimulacaoCusto() {
  const [analises, setAnalises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [regimeSim, setRegimeSim] = useState('simples_nacional');
  const [fornecedorSim, setFornecedorSim] = useState('__todos');

  useEffect(() => {
    async function load() {
      const data = await base44.entities.NFeAnalise.list('-data_emissao', 5000);
      setAnalises(Array.isArray(data) ? data : []);
      setLoading(false);
    }
    load();
  }, []);

  const skus = useMemo(() => agruparProdutosNFe(analises), [analises]);

  // Ao mudar de SKU, resetar fornecedor
  useEffect(() => { setFornecedorSim('__todos'); }, [selecionado?.sku_key]);

  // Item representativo do SKU filtrado pelo fornecedor selecionado
  const itemRef = useMemo(() => {
    if (!selecionado) return null;
    const itens = fornecedorSim === '__todos'
      ? selecionado.itens
      : selecionado.itens.filter(it => it.emitente_nome === fornecedorSim);
    if (itens.length === 0) return null;
    // usa o mais recente como referência para simulação
    return [...itens].sort((a, b) => (b.data_emissao || '').localeCompare(a.data_emissao || ''))[0];
  }, [selecionado, fornecedorSim]);

  // Regime atual do emitente do item (para comparação)
  const regimeAtual = itemRef?.emitente_regime || 'desconhecido';

  // Cálculos: atual (regime real do emitente) × simulado
  const calcAtual = useMemo(() =>
    itemRef ? calcularCustoEfetivo(itemRef, regimeAtual === 'simples_nacional' ? 'simples_nacional' : 'lucro_presumido_real') : null
  , [itemRef, regimeAtual]);

  const calcSimulado = useMemo(() =>
    itemRef ? calcularCustoEfetivo(itemRef, regimeSim) : null
  , [itemRef, regimeSim]);

  // Série histórica (sempre usando regime simulado para visualização)
  const serie = useMemo(() => {
    if (!selecionado) return [];
    const filtrado = fornecedorSim === '__todos'
      ? selecionado
      : { ...selecionado, itens: selecionado.itens.filter(it => it.emitente_nome === fornecedorSim) };
    return serieHistoricaCusto(filtrado, regimeSim);
  }, [selecionado, fornecedorSim, regimeSim]);

  if (loading) {
    return <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Simulação de Custo"
        subtitle="Altere regime tributário ou fornecedor e veja o impacto instantâneo no custo efetivo"
      />

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-3 mb-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0">
          <FlaskConical className="w-4 h-4 text-white" />
        </div>
        <div className="text-xs text-indigo-900 leading-relaxed">
          <strong>Motor what-if:</strong> selecione um SKU à esquerda e altere regime/fornecedor. O DRE recalcula em tempo real comparando o cenário atual (regime real do emitente) com o cenário simulado. O gráfico mostra o histórico completo de compras deste SKU em todas as NF-e processadas.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
        {/* Coluna esquerda: seletor */}
        <SeletorSKU skus={skus} selecionado={selecionado} onSelect={setSelecionado} />

        {/* Coluna direita: detalhe */}
        <div className="space-y-4">
          {!selecionado ? (
            <div className="bg-card border rounded-xl p-10 text-center">
              <Info className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold">Selecione um SKU para iniciar a simulação</p>
              <p className="text-xs text-muted-foreground mt-1">
                {skus.length === 0 ? 'Processe NF-e na tela "Análise XML NF-e" para popular os produtos.' : `${skus.length} SKUs disponíveis`}
              </p>
            </div>
          ) : (
            <>
              {/* Cabeçalho SKU */}
              <div className="bg-card border rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">SKU selecionado</p>
                <p className="text-base font-bold">{selecionado.descricao}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  <span>NCM: <strong className="font-mono">{selecionado.ncm || '—'}</strong></span>
                  <span>Ocorrências: <strong>{selecionado.total_ocorrencias}</strong></span>
                  <span>Fornecedores: <strong>{selecionado.fornecedores.length}</strong></span>
                  <span>Faixa de preço: <strong>{formatCurrency(selecionado.custoMin)} – {formatCurrency(selecionado.custoMax)}</strong></span>
                  {selecionado.variacaoPct > 0 && (
                    <span>Variação: <strong className={selecionado.variacaoPct > 30 ? 'text-rose-600' : 'text-amber-600'}>±{selecionado.variacaoPct.toFixed(1)}%</strong></span>
                  )}
                </div>
              </div>

              {/* Controles de simulação */}
              <div className="bg-card border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Fornecedor (filtro)</label>
                  <Select value={fornecedorSim} onValueChange={setFornecedorSim}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__todos">Todos os fornecedores ({selecionado.fornecedores.length})</SelectItem>
                      {selecionado.fornecedores.map(f => (
                        <SelectItem key={f.nome} value={f.nome}>
                          {f.nome} · {formatCurrency(f.unitario_medio)}/un · {f.count}×
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Regime simulado (comprador)</label>
                  <Select value={regimeSim} onValueChange={setRegimeSim}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples_nacional">Simples Nacional (sem créditos)</SelectItem>
                      <SelectItem value="lucro_presumido_real">Lucro Presumido/Real (com créditos ICMS/PIS/COFINS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* DREs comparativos */}
              {itemRef && calcAtual && calcSimulado ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <DRESimuladoCard
                    titulo="Cenário atual"
                    subtitulo={`Emitente: ${itemRef.emitente_nome} · Regime detectado: ${regimeAtual.replace(/_/g, ' ')}`}
                    calc={calcAtual}
                    regime={regimeAtual === 'simples_nacional' ? 'simples_nacional' : 'lucro_presumido_real'}
                    color="indigo"
                  />
                  <DRESimuladoCard
                    titulo="Cenário simulado"
                    subtitulo={`Regime: ${regimeSim === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido/Real'}${fornecedorSim !== '__todos' ? ` · Fornecedor: ${fornecedorSim}` : ''}`}
                    calc={calcSimulado}
                    regime={regimeSim}
                    variacao={calcSimulado.custo_efetivo - calcAtual.custo_efetivo}
                    color={calcSimulado.custo_efetivo < calcAtual.custo_efetivo ? 'emerald' : 'rose'}
                  />
                </div>
              ) : (
                <div className="bg-card border rounded-xl p-6 text-center text-xs text-muted-foreground">
                  Nenhum item encontrado para o fornecedor selecionado.
                </div>
              )}

              {/* Gráfico histórico */}
              <GraficoHistoricoCusto serie={serie} regime={regimeSim} />

              {/* Tabela de fornecedores do SKU */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b bg-muted/30">
                  <p className="text-xs font-bold uppercase">Fornecedores deste SKU</p>
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-2 py-1.5">Fornecedor</th>
                      <th className="text-left px-2 py-1.5">UF</th>
                      <th className="text-right px-2 py-1.5">Compras</th>
                      <th className="text-right px-2 py-1.5">Qtd total</th>
                      <th className="text-right px-2 py-1.5">Unitário médio</th>
                      <th className="text-right px-2 py-1.5">Gasto total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selecionado.fornecedores.map((f, i) => (
                      <tr key={i} className={`border-b ${fornecedorSim === f.nome ? 'bg-indigo-50' : ''}`}>
                        <td className="px-2 py-1.5 font-medium max-w-[240px] truncate">{f.nome}</td>
                        <td className="px-2 py-1.5">{f.uf || '—'}</td>
                        <td className="px-2 py-1.5 text-right">{f.count}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{f.soma_qtd.toFixed(0)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{formatCurrency(f.unitario_medio)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(f.soma_valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}