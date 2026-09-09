import {
  LayoutDashboard, Landmark, FileText, Receipt, ShoppingCart,
  Hammer, CreditCard, DollarSign, Users, BarChart3, CloudUpload, Map,
  Scale, Package, GitCompare, FolderOpen, Target, Repeat, Bot, FileCode,
  Calculator, Activity, Link2, ShieldCheck, Wallet, FolderSync, CircleDollarSign, PieChart
} from 'lucide-react';

// Menu agrupado pela lógica dos fluxos (espelha o Diagnóstico de Fluxos)
export const navGroups = [
  {
    label: 'Visão Geral',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/mapa', label: 'Mapa Geral', icon: Map },
      { path: '/fluxocaixa', label: 'Fluxo de Caixa', icon: BarChart3 },
      { path: '/extrato', label: 'Extrato Bancário', icon: Landmark },
      { path: '/analise-classificacao', label: 'Análise por Classificação', icon: PieChart },
      { path: '/relatorio-gerencial', label: 'Relatório Gerencial', icon: BarChart3 },
      { path: '/dre-operacional', label: 'DRE Operacional', icon: Scale },
    ],
  },
  {
    label: 'Receita',
    items: [
      { path: '/faturamento', label: 'Faturamento', icon: FileText },
      { path: '/cobrancas', label: 'Cobranças Sicredi', icon: Receipt },
    ],
  },
  {
    label: 'Pagamentos',
    items: [
      { path: '/contas-a-pagar', label: 'Contas a Pagar', icon: CircleDollarSign },
      { path: '/tributos', label: 'Tributos', icon: DollarSign },
      { path: '/funcionarios', label: 'Folha de Pagamento', icon: Users },
      { path: '/prolabore', label: 'Pró-labore', icon: Wallet },
      { path: '/recorrentes', label: 'Despesas Recorrentes', icon: Repeat },
      { path: '/obras', label: 'Obras e Reformas', icon: Hammer },
    ],
  },
  {
    label: 'Compras & Estoque',
    items: [
      { path: '/compras', label: 'Compras & Despesas', icon: ShoppingCart },
      { path: '/produtos', label: 'Produtos & Fornecedores', icon: Package },
      { path: '/cruzamento-compras', label: 'Compras × Pagamentos', icon: GitCompare },
      { path: '/controle-produtos', label: 'Controle de Produtos (IA)', icon: Bot },
    ],
  },
  {
    label: 'Cartões',
    items: [
      { path: '/cartoes', label: 'Cartões de Crédito', icon: CreditCard },
    ],
  },
  {
    label: 'Fiscal & SEFAZ',
    items: [
      { path: '/pastas-monitoradas', label: 'Pastas do Drive (Auto)', icon: FolderSync },
      { path: '/analise-nfe', label: 'Análise XML NF-e (Drive)', icon: FileCode },
      { path: '/nfe-recebidas', label: 'NFes Recebidas (AN)', icon: FileText },
      { path: '/certificado-nfe', label: 'Certificado NF-e (SEFAZ)', icon: ShieldCheck },
      { path: '/dre-tributario', label: 'DRE Tributário', icon: Scale },
      { path: '/simulacao-custo', label: 'Simulação de Custo', icon: Calculator },
    ],
  },
  {
    label: 'Conciliação & Diagnóstico',
    items: [
      { path: '/conciliacao', label: 'Conciliação Mensal', icon: Scale },
      { path: '/conciliacao360', label: 'Conciliação 360°', icon: Target },
      { path: '/diagnostico-conciliacao', label: 'Diagnóstico de Fluxos', icon: Activity },
      { path: '/cobertura-conciliacao', label: 'Cobertura Conciliação', icon: Link2 },
    ],
  },
  {
    label: 'Dados & Auditoria',
    items: [
      { path: '/importar', label: 'Importar Documento', icon: CloudUpload },
      { path: '/auditoria', label: 'Auditoria de Arquivos', icon: FolderOpen },
    ],
  },
];

// Lista plana para o Breadcrumb encontrar o rótulo
export const navItems = navGroups.flatMap(g => g.items);