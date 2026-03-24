import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Landmark, FileText, Receipt, ShoppingCart, 
  Hammer, CreditCard, Map, ChevronLeft, ChevronRight, LogOut
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

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-[72px]' : 'w-[260px]'} bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
                <span className="text-sidebar-primary-foreground font-bold text-sm">NT</span>
              </div>
              <div className="min-w-0">
                <p className="text-sidebar-accent-foreground font-semibold text-sm truncate">NeuralTec</p>
                <p className="text-sidebar-foreground text-[10px] truncate">Sicredi 36092-2 · Coop 2604</p>
              </div>
            </div>
          )}
          {collapsed && (
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
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

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}