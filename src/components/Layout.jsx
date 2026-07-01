import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ChevronLeft, ChevronRight, LogOut,
  AlertTriangle, ChevronRight as BreadChevron, Menu, MessageCircle } from
'lucide-react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import PainelNotificacoes from './notificacoes/PainelNotificacoes';
import SidebarNav from './SidebarNav';
import { navItems } from '@/lib/navConfig';

function AlertBar() {
  // Alerta será alimentado dinamicamente por Tributo quando implementado
  const alerts = [
  { msg: 'DAS Março 2026: R$ 36.377 — verificar valor elevado', color: 'red' }].
  filter(Boolean);

  if (alerts.length === 0) return null;
  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-4 flex-wrap">
      <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
      {alerts.map((a, i) =>
      <span key={i} className={`text-xs font-medium ${a.color === 'red' ? 'text-red-700' : 'text-yellow-800'}`}>
          {a.msg}
          {i < alerts.length - 1 && <span className="mx-2 text-yellow-400">·</span>}
        </span>
      )}
    </div>);

}

function Breadcrumb({ location }) {
  const item = navItems.find((n) => n.path === location.pathname);
  if (!item || item.path === '/') return null;





  return null;









}

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const today = new Date();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen &&
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={() => setMobileOpen(false)} />

      }

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 md:z-auto h-full
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        ${collapsed ? 'md:w-[72px]' : 'md:w-[260px]'} w-[260px]
        bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
          {!collapsed ?
          <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
                <span className="text-sidebar-primary-foreground font-bold text-sm">NT</span>
              </div>
              <div className="min-w-0">
                <p className="text-sidebar-accent-foreground font-semibold text-sm truncate">NeuralTec</p>
                <p className="text-sidebar-foreground text-[10px] truncate">Sicredi 36092-2 · Coop 2604</p>
              </div>
            </div> :

          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
              <span className="text-sidebar-primary-foreground font-bold text-sm">NT</span>
            </div>
          }
        </div>

        {/* Nav agrupada por fluxo — arrastável */}
        <SidebarNav
          collapsed={collapsed}
          currentPath={location.pathname}
          onNavigate={() => setMobileOpen(false)} />
        

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border space-y-0.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full">
            
            {collapsed ? <ChevronRight className="w-5 h-5 mx-auto" /> : <><ChevronLeft className="w-5 h-5" /><span>Recolher</span></>}
          </button>
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full">
            
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
        <div className="relative flex items-center justify-end h-9 border-b bg-card shrink-0 px-4 mx-1">
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
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105">
        
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-semibold hidden sm:inline">Consultor Financeiro</span>
      </a>
    </div>);

}