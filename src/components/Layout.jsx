import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Landmark, FileText, Receipt, ShoppingCart, 
  Hammer, CreditCard, Map, ChevronLeft, ChevronRight, LogOut,
  AlertTriangle, ChevronRight as BreadChevron, DollarSign, Users, BarChart3, CloudUpload, Menu, X, Scale, Package, GitCompare, Wallet, FolderOpen, Target, Repeat, Bot, FileCode, Calculator, FlaskConical, Activity, Link2, MessageCircle
} from 'lucide-react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import PainelNotificacoes from './notificacoes/PainelNotificacoes';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/extrato', label: 'Extrato Bancário', icon: Landmark },
  { path: '/faturamento', label: 'Faturamento', icon: FileText },
  { path: '/cobrancas', label: 'Cobranças Sicredi', icon: Receipt },
  { path: '/compras', label: 'Compras & Despesas', icon: ShoppingCart },
  { path: '/obras', label: 'Obras e Reformas', icon: Hammer },
  { path: '/cartoes', label: 'Cartões de Crédito', icon: CreditCard },
  { path: '/tributos', label: 'Tributos', icon: DollarSign },
  { path: '/funcionarios', label: 'Pessoal', icon: Users },
  { path: '/contas-a-pagar', label: 'Contas a Pagar', icon: Wallet },
  { path: '/fluxocaixa', label: 'Fluxo de Caixa', icon: BarChart3 },
  { path: '/mapa', label: 'Mapa Geral', icon: Map },
  { path: '/importar', label: 'Importar Documento', icon: CloudUpload },
  { path: '/conciliacao', label: 'Conciliação Mensal', icon: Scale },
  { path: '/conciliacao360', label: 'Conciliação 360°', icon: Target },
  { path: '/diagnostico-conciliacao', label: 'Diagnóstico de Fluxos', icon: Activity },
  { path: '/cobertura-conciliacao', label: 'Cobertura Conciliação', icon: Link2 },
  { path: '/controle-produtos', label: 'Controle de Produtos (IA)', icon: Bot },
  { path: '/analise-nfe', label: 'Análise XML NF-e (Drive)', icon: FileCode },
  { path: '/dre-tributario', label: 'DRE Tributário', icon: Scale },
  { path: '/simulacao-custo', label: 'Simulação de Custo', icon: Calculator },
  { path: '/produtos', label: 'Produtos & Fornecedores', icon: Package },
  { path: '/cruzamento-compras', label: 'Compras × Pagamentos', icon: GitCompare },
  { path: '/recorrentes', label: 'Despesas Recorrentes', icon: Repeat },
  { path: '/auditoria', label: 'Auditoria de Arquivos', icon: FolderOpen },
];

function AlertBar() {
  // Alerta será alimentado dinamicamente por Tributo quando implementado
  const alerts = [
    { msg: 'DAS Março 2026: R$ 36.377 — verificar valor elevado', color: 'red' },
  ].filter(Boolean);

  if (alerts.length === 0) return null;
  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-4 flex-wrap">
      <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
      {alerts.map((a, i) => (
        <span key={i} className={`text-xs font-medium ${a.color === 'red' ? 'text-red-700' : 'text-yellow-800'}`}>
          {a.msg}
          {i < alerts.length - 1 && <span className="mx-2 text-yellow-400">·</span>}
        </span>
      ))}
    </div>
  );
}

function Breadcrumb({ location }) {
  const item = navItems.find(n => n.path === location.pathname);
  if (!item || item.path === '/') return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground px-6 py-2 border-b bg-card">
      <LayoutDashboard className="w-3.5 h-3.5" />
      <span className="font-medium text-foreground">Dashboard</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground px-6 py-2 border-b bg-card">
      <Link to="/" className="flex items-center gap-1 hover:text-primary transition-colors">
        <LayoutDashboard className="w-3.5 h-3.5" />
        <span>Dashboard</span>
      </Link>
      <BreadChevron className="w-3.5 h-3.5" />
      <span className="font-medium text-foreground">{item.label}</span>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const today = new Date();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 md:z-auto h-full
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        ${collapsed ? 'md:w-[72px]' : 'md:w-[260px]'} w-[260px]
        bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
          {!collapsed ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
                <span className="text-sidebar-primary-foreground font-bold text-sm">NT</span>
              </div>
              <div className="min-w-0">
                <p className="text-sidebar-accent-foreground font-semibold text-sm truncate">NeuralTec</p>
                <p className="text-sidebar-foreground text-[10px] truncate">Sicredi 36092-2 · Coop 2604</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
              <span className="text-sidebar-primary-foreground font-bold text-sm">NT</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20' 
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border space-y-0.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
          >
            {collapsed ? <ChevronRight className="w-5 h-5 mx-auto" /> : <><ChevronLeft className="w-5 h-5" /><span>Recolher</span></>}
          </button>
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex md:hidden items-center gap-3 px-4 h-14 border-b bg-sidebar shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-sidebar-foreground">
            <Menu className="w-6 h-6" />
          </button>
          <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-xs">NT</span>
          </div>
          <span className="text-sidebar-accent-foreground font-semibold text-sm">NeuralTec</span>
        </div>
        <AlertBar />
        <div className="relative flex items-center justify-end px-4 h-9 border-b bg-card shrink-0">
          <PainelNotificacoes />
        </div>
        <Breadcrumb location={location} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        {/* Footer */}
        <div className="border-t bg-card px-6 py-2 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <span>NeuralTec Distribuição e Tecnologia Ltda</span>
          <span>Sicredi Conta 36092-2 · Cooperativa 2604 · {today.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Botão flutuante de WhatsApp — Consultor Financeiro IA */}
      <a
        href={base44.agents.getWhatsAppConnectURL('financial_health_advisor')}
        target="_blank"
        rel="noopener noreferrer"
        title="Conversar com o Consultor Financeiro no WhatsApp"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-semibold hidden sm:inline">Consultor Financeiro</span>
      </a>
    </div>
  );
}