import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Landmark, FileText, Receipt, ShoppingCart, 
  Hammer, CreditCard, Map, ChevronLeft, ChevronRight, LogOut,
  AlertTriangle, ChevronRight as BreadChevron
} from 'lucide-react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/extrato', label: 'Extrato Bancário', icon: Landmark },
  { path: '/faturamento', label: 'Faturamento', icon: FileText },
  { path: '/cobrancas', label: 'Cobranças Sicredi', icon: Receipt },
  { path: '/compras', label: 'Compras', icon: ShoppingCart },
  { path: '/obras', label: 'Obras e Reformas', icon: Hammer },
  { path: '/cartoes', label: 'Cartões de Crédito', icon: CreditCard },
  { path: '/mapa', label: 'Mapa Geral', icon: Map },
];

function AlertBar() {
  const today = new Date();
  const day = today.getDate();
  const alerts = [
    { msg: 'DAS Março 2026: R$ 36.377 — verificar valor elevado', color: 'red' },
    day <= 25 && { msg: `Sicredi NeuralTec: fatura R$ 672,85 vence dia 25`, color: 'yellow' },
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
  const today = new Date();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-[72px]' : 'w-[260px]'} bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0`}>
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
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
        <AlertBar />
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
    </div>
  );
}