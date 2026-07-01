import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Calculator, Loader2, Package2 } from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import SKUSelector from '../components/simulacao/SKUSelector';
import PainelSimulacao from '../components/simulacao/PainelSimulacao';
import GraficoHistoricoSKU from '../components/simulacao/GraficoHistoricoSKU';
import { achatarProdutosNFe, agruparSKUs } from '../lib/custoSimulacaoEngine';

export default function SimulacaoCusto() {
  const [analises, setAnalises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skuSelecionado, setSkuSelecionado] = useState(null);
  const [regimeGrafico, setRegimeGrafico] = useState('simples_nacional');

  useEffect(() => {
    async function load() {
      const lst = await base44.entities.NFeAnalise.list('-data_emissao', 5000);
      setAnalises(Array.isArray(lst) ? lst : []);
      setLoading(false);
    }
    load();
  }, []);

  const skus = useMemo(() => {
    const linhas = achatarProdutosNFe(analises);
    return agruparSKUs(linhas);
  }, [analises]);

  useEffect(() => {
    // Seleciona o primeiro SKU recorrente automaticamente
    if (!skuSelecionado && skus.length > 0) {
      const primeiro = skus.find(s => s.recorrente) || skus[0];
      setSkuSelecionado(primeiro);
    }
  }, [skus, skuSelecionado]);

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  if (skus.length === 0) {
    return (
      <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
        <PageHeader title="Simulação de Custo" subtitle="Avalie o impacto de regime tributário e troca de fornecedor" />
        <div className="bg-card border rounded-xl p-10 text-center">
          <Package2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold mb-1">Nenhum produto analisado ainda</p>
          <p className="text-xs text-muted-foreground">Processe XMLs de NF-e na aba "Análise XML NF-e" para alimentar a simulação.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Simulação de Custo"
        subtitle={`${skus.length} SKUs agrupados · ${skus.filter(s => s.recorrente).length} recorrentes · ${analises.length} NF-e`}
      />

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-3 mb-5">
        <div className="flex items-start gap-2">
          <Calculator className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-indigo-900">Como funciona</p>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              1. <strong>Selecione um produto</strong> da lista (SKUs agrupados por similaridade+NCM).
              2. <strong>Compare dois cenários</strong> trocando regime tributário e/ou fornecedor.
              3. Veja o <strong>impacto no custo efetivo</strong> e o gráfico histórico de preços.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
        <SKUSelector skus={skus} selecionado={skuSelecionado} onSelect={setSkuSelecionado} />

        <div className="space-y-5 min-w-0">
          {skuSelecionado ? (
            <>
              <PainelSimulacao sku={skuSelecionado} />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setRegimeGrafico('simples_nacional')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${regimeGrafico === 'simples_nacional' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card hover:bg-muted/50'}`}
                  >
                    Simples Nacional
                  </button>
                  <button
                    onClick={() => setRegimeGrafico('lucro_presumido_real')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${regimeGrafico === 'lucro_presumido_real' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card hover:bg-muted/50'}`}
                  >
                    Lucro Presumido/Real
                  </button>
                </div>
                <GraficoHistoricoSKU sku={skuSelecionado} regime={regimeGrafico} />
              </div>
            </>
          ) : (
            <div className="bg-card border rounded-xl p-10 text-center">
              <p className="text-sm text-muted-foreground">Selecione um produto na lista ao lado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}