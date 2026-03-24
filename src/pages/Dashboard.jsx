import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Landmark, FileText, Receipt, ShoppingCart, Hammer, CreditCard, AlertTriangle, TrendingUp } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import SectionHeader from '../components/dashboard/SectionHeader';
import { formatCurrency } from '../lib/formatters';

export default function Dashboard() {
  const [stats, setStats] = useState({
    bankBalance: 47415, liesch: 41, fundos: 100000,
    recebimentosYTD: 421769, pagamentosYTD: -390000,
    totalFaturado: 570423, aReceber: 143000,
    tiago: 235000, thais: 315000,
    totalEmitido: 745734, recebido: 466030, emAberto: 279704,
    totalCompras: -400283,
    totalObras: -11557,
    totalCartoes: -26553, proxVenc: 672.85,
    totalTributos: -57738, dasMarco: 36377,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [lancamentos, nfs, titulos, compras, obras, faturas] = await Promise.all([
          base44.entities.LancamentoBancario.list(),
          base44.entities.NotaFiscal.list(),
          base44.entities.TituloCobranca.list(),
          base44.entities.ItemCompra.list(),
          base44.entities.ObraReforma.list(),
          base44.entities.FaturaCartao.list(),
        ]);

        if (lancamentos.length > 0) {
          const rec = lancamentos.filter(l => l.categoria === 'recebimento').reduce((s, l) => s + (l.valor || 0), 0);
          const pag = lancamentos.filter(l => l.categoria !== 'recebimento').reduce((s, l) => s + (l.valor || 0), 0);
          const last = lancamentos.sort((a, b) => new Date(b.data) - new Date(a.data))[0];
          setStats(prev => ({
            ...prev,
            bankBalance: last?.saldo_apos ?? prev.bankBalance,
            recebimentosYTD: rec || prev.recebimentosYTD,
            pagamentosYTD: pag ? -Math.abs(pag) : prev.pagamentosYTD,
          }));
        }
        if (nfs.length > 0) {
          setStats(prev => ({
            ...prev,
            totalFaturado: nfs.reduce((s, n) => s + (n.valor_total || 0), 0),
            aReceber: nfs.reduce((s, n) => s + (n.valor_aberto || 0), 0),
          }));
        }
        if (titulos.length > 0) {
          setStats(prev => ({
            ...prev,
            totalEmitido: titulos.reduce((s, t) => s + (t.valor_titulo || 0), 0),
            recebido: titulos.filter(t => t.status === 'pago').reduce((s, t) => s + (t.valor_pago || 0), 0),
            emAberto: titulos.filter(t => t.status !== 'pago').reduce((s, t) => s + (t.valor_titulo || 0), 0),
          }));
        }
        if (compras.length > 0) {
          setStats(prev => ({
            ...prev,
            totalCompras: -Math.abs(compras.reduce((s, c) => s + (c.valor_total || 0), 0)),
          }));
        }
        if (obras.length > 0) {
          setStats(prev => ({
            ...prev,
            totalObras: -Math.abs(obras.reduce((s, o) => s + (o.valor || 0), 0)),
          }));
        }
      } catch (e) {
        // keep defaults
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const percRecebido = stats.totalEmitido > 0 ? ((stats.recebido / stats.totalEmitido) * 100) : 62.6;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard Financeiro</h1>
        <p className="text-muted-foreground mt-1">NeuralTec Distribuição e Tecnologia Ltda · Sicredi 36092-2</p>
      </div>

      {/* Banco */}
      <SectionHeader title="Banco" icon={Landmark} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Saldo NeuralTec" value={formatCurrency(stats.bankBalance)} subtitle="Conta 36092-2" icon={Landmark} color="blue" href="/extrato" />
        <StatCard title="Saldo Liesch + Fundos" value={formatCurrency(stats.liesch + stats.fundos)} subtitle={`Liesch R$41 + Fundos R$100k`} icon={Landmark} color="blue" href="/extrato" />
        <StatCard title="Recebimentos YTD" value={formatCurrency(stats.recebimentosYTD)} icon={TrendingUp} color="green" href="/extrato" />
        <StatCard title="Pagamentos YTD" value={formatCurrency(stats.pagamentosYTD)} icon={TrendingUp} color="red" href="/extrato" />
      </div>

      {/* Faturamento */}
      <SectionHeader title="Faturamento" icon={FileText} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Faturado" value={formatCurrency(stats.totalFaturado)} icon={FileText} color="green" href="/faturamento" />
        <StatCard title="A Receber" value={formatCurrency(stats.aReceber)} icon={FileText} color="yellow" href="/faturamento" />
        <StatCard title="Tiago V-01" value={formatCurrency(stats.tiago)} subtitle="Vendedor" icon={FileText} color="blue" href="/faturamento" />
        <StatCard title="Thais V-05" value={formatCurrency(stats.thais)} subtitle="Vendedora" icon={FileText} color="purple" href="/faturamento" />
      </div>

      {/* Cobranças */}
      <SectionHeader title="Cobranças Sicredi" icon={Receipt} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Emitido" value={formatCurrency(stats.totalEmitido)} icon={Receipt} color="blue" href="/cobrancas" />
        <StatCard title="Recebido" value={formatCurrency(stats.recebido)} subtitle={`${percRecebido.toFixed(1)}% do total`} icon={Receipt} color="green" href="/cobrancas" />
        <StatCard title="Em Aberto" value={formatCurrency(stats.emAberto)} icon={Receipt} color="orange" href="/cobrancas" />
      </div>

      {/* Compras + Obras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <SectionHeader title="Compras" icon={ShoppingCart} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard title="Total Compras" value={formatCurrency(stats.totalCompras)} subtitle="À Vista 65% · ML 27% · Pauta 8%" icon={ShoppingCart} color="red" href="/compras" />
          </div>
        </div>
        <div>
          <SectionHeader title="Obras e Reformas" icon={Hammer} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard title="Total YTD" value={formatCurrency(stats.totalObras)} subtitle="Mão de obra R$9.500 · Mat. R$2.057" icon={Hammer} color="emerald" href="/obras" />
          </div>
        </div>
      </div>

      {/* Cartões + Tributos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <SectionHeader title="Cartões de Crédito" icon={CreditCard} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard title="Pago no Banco" value={formatCurrency(stats.totalCartoes)} subtitle="7 cartões cadastrados" icon={CreditCard} color="purple" href="/cartoes" />
            <StatCard title="Próx. Vencimento" value={formatCurrency(stats.proxVenc)} subtitle="25/03/2025" icon={CreditCard} color="yellow" href="/cartoes" />
          </div>
        </div>
        <div>
          <SectionHeader title="Tributos" icon={AlertTriangle} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard title="Tributos YTD" value={formatCurrency(stats.totalTributos)} icon={AlertTriangle} color="red" />
            <StatCard title="DAS Março" value={formatCurrency(stats.dasMarco)} subtitle="⚠️ Verificar valor alto" icon={AlertTriangle} color="yellow" />
          </div>
        </div>
      </div>
    </div>
  );
}