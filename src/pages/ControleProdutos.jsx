import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Package, Bot, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import KPIGridControle from '../components/controle/KPIGridControle';
import AlertasControle from '../components/controle/AlertasControle';
import TabelaGruposSKU from '../components/controle/TabelaGruposSKU';
import ChatControllerAgent from '../components/controle/ChatControllerAgent';
import { agruparProdutos, gerarAlertasProdutos, calcularKPIs } from '../lib/productOrganizationEngine';

export default function ControleProdutos() {
  const [itensCompra, setItensCompra] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const compras = await base44.entities.ItemCompra.list('-data_emissao', 1000);
      setItensCompra(Array.isArray(compras) ? compras : []);
      setLoading(false);
    }
    load();
  }, []);

  const grupos = useMemo(() => agruparProdutos(itensCompra), [itensCompra]);
  const alertas = useMemo(() => gerarAlertasProdutos(grupos, itensCompra), [grupos, itensCompra]);
  const kpis = useMemo(() => calcularKPIs(grupos, itensCompra), [grupos, itensCompra]);

  if (loading) {
    return <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>;
  }

  return (
    <div className="p-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Controle de Produtos"
        subtitle="3-way matching · custo médio ponderado · conformidade contábil"
      />

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-indigo-900">Controle financeiro por padrão contábil global (3-Way Matching)</p>
            <p className="text-xs text-indigo-800 leading-relaxed">
              Cada compra deve ter: <strong>(1) Nota/Comprovante</strong> ↔ <strong>(2) Pagamento (banco ou cartão)</strong> ↔ <strong>(3) Produto padronizado</strong>.
              Esta tela agrupa automaticamente compras equivalentes em SKUs virtuais, calcula <strong>custo médio ponderado</strong> e sinaliza anomalias de preço, duplicidade e concentração de fornecedor.
            </p>
          </div>
        </div>
      </div>

      <KPIGridControle kpis={kpis} />
      <AlertasControle alertas={alertas} />

      <Tabs defaultValue="grupos" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="grupos" className="gap-2"><Package className="w-4 h-4" /> Produtos Agrupados (SKU virtual)</TabsTrigger>
          <TabsTrigger value="agente" className="gap-2"><Bot className="w-4 h-4" /> Falar com o Controller</TabsTrigger>
        </TabsList>

        <TabsContent value="grupos">
          <TabelaGruposSKU grupos={grupos} />
        </TabsContent>

        <TabsContent value="agente">
          <ChatControllerAgent />
        </TabsContent>
      </Tabs>
    </div>
  );
}