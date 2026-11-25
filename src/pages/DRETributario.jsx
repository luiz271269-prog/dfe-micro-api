import { useState, useEffect } from 'react';
import { consolidarDRETributario } from '@/functions/consolidarDRETributario';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Calculator, TrendingDown, Scale, Package, Store, FileDown } from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import MonthNavigator from '../components/shared/MonthNavigator';
import DASAlertBar from '../components/dre/DASAlertBar';
import { formatCurrency } from '../lib/formatters';

import TabelaDemonstrativo from '@/components/dre/TabelaDemonstrativo';
import linhasTributarias from '@/components/dre/linhasTributarias';
import { sinalDRE } from '@/components/dre/modeloDRE';

export default function DRETributario() {
  const [mes, setMes] = useState(null);
  const [regime, setRegime] = useState('simples_nacional');
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await consolidarDRETributario({ mes_referencia: mes, regime_comprador: regime });
      setDados(res?.data || null);
    } catch (e) {
      setErro(e.message);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [mes, regime]); // eslint-disable-line

  function exportarCSV() {
    if (!dados) return;
    const { dre, tributos_consolidados: t, top_produtos_maior_impacto } = dados;
    const linhas = [
      ['DRE TRIBUTÁRIO — Impactos das compras'],
      ['Mês', dados.mes_referencia],
      ['Regime', regime],
      ['Total NF-e', dados.total_nfe],
      [],
      ['LINHA', 'VALOR (R$)'],
      ...linhasTributarias(dre).map(l=>[l.label,l.value==null?'':sinalDRE(l,l.value).toFixed(2)]),
      ['Impacto tributário sobre compras (%)', dre.impacto_tributario_sobre_compras_percentual.toFixed(2)],
      [],
      ['TOP PRODUTOS POR IMPACTO TRIBUTÁRIO'],
      ['Produto', 'NCM', 'Valor', 'ICMS-ST', 'IPI', 'Custo efetivo', 'Impacto %'],
      ...top_produtos_maior_impacto.map(p => [
        p.descricao, p.ncm || '', p.valor_produto.toFixed(2),
        p.icms_st.toFixed(2), p.ipi.toFixed(2),
        p.custo_efetivo.toFixed(2), p.impacto_tributario_percentual.toFixed(2),
      ]),
    ];
    const csv = linhas.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dre_tributario_${dados.mes_referencia}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="DRE Tributário"
        subtitle="Impacto de ICMS-ST e IPI no custo efetivo dos produtos — consolidado das NF-e"
      >
        <Select value={regime} onValueChange={setRegime}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="simples_nacional">Simples Nacional (comprador)</SelectItem>
            <SelectItem value="lucro_presumido_real">Lucro Presumido/Real</SelectItem>
          </SelectContent>
        </Select>
        <MonthNavigator selectedMonth={mes} onSelectMonth={setMes} />
        <Button variant="outline" onClick={carregar} className="gap-2"><RefreshCw className="w-4 h-4" /> Atualizar</Button>
        {dados && <Button variant="outline" onClick={exportarCSV} className="gap-2"><FileDown className="w-4 h-4" /> Exportar</Button>}
      </PageHeader>

      <DASAlertBar mesReferencia={mes} />

      {loading && (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      )}

      {erro && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">{erro}</div>
      )}

      {!loading && dados && dados.total_nfe === 0 && (
        <div className="bg-card border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">{dados.mensagem}</p>
          <p className="text-xs text-muted-foreground mt-2">Importe XMLs de NF-e na tela <strong>Análise NFe</strong> ou registre compras em <strong>Compras</strong> para alimentar o DRE.</p>
        </div>
      )}

      {!loading && dados && dados.total_nfe > 0 && dados.aviso && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <span className="text-xs text-blue-800">{dados.aviso}</span>
        </div>
      )}

      {!loading && dados && dados.total_nfe > 0 && (
        <div className="space-y-5">
          {/* KPIs topo */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-card border rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">NFs consolidadas</p>
              <p className="text-xl font-bold">{dados.total_nfe}</p>
              <p className="text-[10px] text-muted-foreground">{dados.total_produtos_analisados} produtos</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-blue-700">Compras brutas</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(dados.dre.compras_brutas)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-amber-700">ICMS-ST</p>
              <p className="text-xl font-bold text-amber-700">{formatCurrency(dados.dre.impostos_nao_recuperaveis.icms_st)}</p>
              <p className="text-[10px] text-muted-foreground">não recuperável</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-purple-700">IPI</p>
              <p className="text-xl font-bold text-purple-700">{formatCurrency(dados.dre.impostos_nao_recuperaveis.ipi)}</p>
              <p className="text-[10px] text-muted-foreground">compõe custo</p>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-rose-700">Impacto no custo</p>
              <p className="text-xl font-bold text-rose-700">+{dados.dre.impacto_tributario_sobre_compras_percentual.toFixed(2)}%</p>
              <p className="text-[10px] text-muted-foreground">sobre compras</p>
            </div>
          </div>

          {/* DRE estruturado */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center gap-2">
              <Scale className="w-5 h-5" />
              <div>
                <p className="text-sm font-bold">Composição fiscal do custo de aquisição · {dados.mes_referencia === 'todos' ? 'Todos os períodos' : dados.mes_referencia}</p>
                <p className="text-[10px] opacity-90">Regime do comprador: <strong>{regime === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido/Real'}</strong> · {dados.dre.creditos_tributarios.observacao}</p>
              </div>
            </div>
            <TabelaDemonstrativo legenda="Composição fiscal, não representa o resultado de vendas" linhas={linhasTributarias(dados.dre)} colunas={[{nome:'Valor (R$)',valor:l=>l.value}]} />
            <div className="px-4 py-3 bg-muted/30 border-t flex flex-wrap gap-6 text-xs">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Impacto tributário no custo</p>
                <p className="text-lg font-bold text-rose-600">+{dados.dre.impacto_tributario_sobre_compras_percentual.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Carga tributária total</p>
                <p className="text-lg font-bold">{formatCurrency(dados.dre.carga_tributaria_total)} ({dados.dre.carga_tributaria_percentual.toFixed(2)}%)</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Origem das compras</p>
                <p className="text-sm font-semibold">Interno: {formatCurrency(dados.distribuicao_uf.interno)} · Interestadual: {formatCurrency(dados.distribuicao_uf.interestadual)}</p>
              </div>
            </div>
          </div>

          {/* Top produtos */}
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Top produtos por impacto tributário (ICMS-ST + IPI)</p>
            <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-2 py-1.5">Produto</th>
                    <th className="text-left px-2 py-1.5">NCM</th>
                    <th className="text-left px-2 py-1.5">Fornecedor</th>
                    <th className="text-right px-2 py-1.5">Valor</th>
                    <th className="text-right px-2 py-1.5">ICMS-ST</th>
                    <th className="text-right px-2 py-1.5">IPI</th>
                    <th className="text-right px-2 py-1.5">Custo efetivo</th>
                    <th className="text-right px-2 py-1.5">Impacto %</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.top_produtos_maior_impacto.map((p, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-2 py-1.5 max-w-[220px] truncate font-medium">{p.descricao}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{p.ncm || '—'}</td>
                      <td className="px-2 py-1.5 max-w-[160px] truncate text-muted-foreground">{p.fornecedor}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(p.valor_produto)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-amber-600">{formatCurrency(p.icms_st)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-purple-600">{formatCurrency(p.ipi)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-bold">{formatCurrency(p.custo_efetivo)}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums font-bold ${p.impacto_tributario_percentual > 15 ? 'text-rose-600' : p.impacto_tributario_percentual > 5 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        +{p.impacto_tributario_percentual.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top fornecedores e NCMs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1"><Store className="w-3.5 h-3.5" /> Fornecedores — maior impacto não recuperável</p>
              <div className="bg-card border rounded-xl overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-2 py-1.5">Fornecedor</th>
                      <th className="text-right px-2 py-1.5">NFs</th>
                      <th className="text-right px-2 py-1.5">ICMS-ST+IPI</th>
                      <th className="text-right px-2 py-1.5">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.top_fornecedores_impacto.map((f, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1.5 max-w-[220px] truncate font-medium">{f.nome}</td>
                        <td className="px-2 py-1.5 text-right">{f.count}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-bold">{formatCurrency(f.impacto_nao_recuperavel)}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${f.impacto_percentual > 15 ? 'text-rose-600 font-bold' : ''}`}>{f.impacto_percentual.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Categorias NCM (4 dígitos)</p>
              <div className="bg-card border rounded-xl overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-2 py-1.5">NCM</th>
                      <th className="text-right px-2 py-1.5">Itens</th>
                      <th className="text-right px-2 py-1.5">Valor</th>
                      <th className="text-right px-2 py-1.5">Custo efetivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.top_categorias_ncm.map((c, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1.5 font-mono">{c.categoria}</td>
                        <td className="px-2 py-1.5 text-right">{c.count}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(c.valor)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-bold">{formatCurrency(c.custo_efetivo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}