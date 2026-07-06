import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Landmark, Wallet, FileText } from 'lucide-react';

const TABS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/extrato', label: 'Extrato', icon: Landmark },
  { path: '/contas-a-pagar', label: 'Contas', icon: Wallet },
  { path: '/faturamento', label: 'Faturamento', icon: FileText },
];

export default function MobileTabBar() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-sidebar border-t border-sidebar-border safe-bottom no-select">
      <div className="grid grid-cols-4 h-14">
        {TABS.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-sidebar-primary' : 'text-sidebar-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}