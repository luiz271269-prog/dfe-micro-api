import { Toaster } from "@/components/ui/toaster"
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import { runSeedIfNeeded } from './lib/seedData';
import Dashboard from './pages/Dashboard';
import ExtratoBancario from './pages/ExtratoBancario';
import Faturamento from './pages/Faturamento';
import Cobrancas from './pages/Cobrancas';
import Compras from './pages/Compras';
import Obras from './pages/Obras';
import Cartoes from './pages/Cartoes';
import Tributos from './pages/Tributos';
import Funcionarios from './pages/Funcionarios';
import ProLabore from './pages/ProLabore';
import FluxoCaixa from './pages/FluxoCaixa';
import MapaGeral from './pages/MapaGeral';
import ImportarDocumento from './pages/ImportarDocumento';
import ConciliacaoMensal from './pages/ConciliacaoMensal';
import ProdutosFornecedores from './pages/ProdutosFornecedores';
import CruzamentoCompras from './pages/CruzamentoCompras';
import Despesas from './pages/Despesas';
import AuditoriaArquivos from './pages/AuditoriaArquivos';
import Conciliacao360 from './pages/Conciliacao360';
import Recorrentes from './pages/Recorrentes';
import ContasAPagar from './pages/ContasAPagar';
import ControleProdutos from './pages/ControleProdutos';
import AnaliseNFe from './pages/AnaliseNFe';
import DRETributario from './pages/DRETributario';
import SimulacaoCusto from './pages/SimulacaoCusto';
import DiagnosticoConciliacao from './pages/DiagnosticoConciliacao';
import CoberturaConciliacao from './pages/CoberturaConciliacao';
import CertificadoNFe from './pages/CertificadoNFe';
import NFeRecebidas from './pages/NFeRecebidas';
import PastasMonitoradas from './pages/PastasMonitoradas';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  useEffect(() => {
    runSeedIfNeeded();
  }, []);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/extrato" element={<ExtratoBancario />} />
        <Route path="/faturamento" element={<Faturamento />} />
        <Route path="/cobrancas" element={<Cobrancas />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/obras" element={<Obras />} />
        <Route path="/cartoes" element={<Cartoes />} />
        <Route path="/tributos" element={<Tributos />} />
        <Route path="/funcionarios" element={<Funcionarios />} />
        <Route path="/prolabore" element={<ProLabore />} />
        <Route path="/fluxocaixa" element={<FluxoCaixa />} />
        <Route path="/mapa" element={<MapaGeral />} />
        <Route path="/importar" element={<ImportarDocumento />} />
        <Route path="/conciliacao" element={<ConciliacaoMensal />} />
        <Route path="/produtos" element={<ProdutosFornecedores />} />
        <Route path="/cruzamento-compras" element={<CruzamentoCompras />} />
        <Route path="/despesas" element={<Despesas />} />
        <Route path="/auditoria" element={<AuditoriaArquivos />} />
        <Route path="/conciliacao360" element={<Conciliacao360 />} />
        <Route path="/recorrentes" element={<Recorrentes />} />
        <Route path="/contas-a-pagar" element={<ContasAPagar />} />
        <Route path="/controle-produtos" element={<ControleProdutos />} />
        <Route path="/analise-nfe" element={<AnaliseNFe />} />
        <Route path="/dre-tributario" element={<DRETributario />} />
        <Route path="/simulacao-custo" element={<SimulacaoCusto />} />
        <Route path="/diagnostico-conciliacao" element={<DiagnosticoConciliacao />} />
        <Route path="/cobertura-conciliacao" element={<CoberturaConciliacao />} />
        <Route path="/certificado-nfe" element={<CertificadoNFe />} />
        <Route path="/nfe-recebidas" element={<NFeRecebidas />} />
        <Route path="/pastas-monitoradas" element={<PastasMonitoradas />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App