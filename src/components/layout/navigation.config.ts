import {
  LayoutDashboard,
  Receipt,
  Users,
  Building2,
  Tags,
  AlertCircle,
  MapPin,
  FileBarChart,
  FileUp,
  Handshake,
  Calculator,
  Settings,
  Bell,
  FileText,
  Wallet,
  TrendingUp,
  ShieldAlert,
  Cog,
  Database,
  Info,
  History,
  CreditCard,
  FileInput,
  Barcode,
  GitMerge,
} from 'lucide-react';
import { AppRole } from '@/types/database';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: AppRole[];
}

export interface NavGroup {
  id: string;
  name: string;
  icon: React.ElementType;
  items: NavItem[];
  badgeKey?: 'caixaUnidades' | 'lucratividade' | 'riscoEstrategia' | 'tributacao';
}

// Tooltips explicativos para cada badge
export const BADGE_TOOLTIPS: Record<string, string> = {
  caixaUnidades: 'unidade(s) sem fechamento de caixa hoje',
  lucratividade: 'categoria(s) sem grupo tributário definido',
  riscoEstrategia: 'alerta(s) de risco ativo(s)',
  tributacao: 'unidade(s) sem configuração tributária',
};

// Labels amigáveis para os papéis
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  contabilidade: 'Contabilidade',
  gestor_unidade: 'Gestor',
  secretaria: 'Atendente',
  financeiro: 'Financeiro',
  contador: 'Contador',
};

// Navegação organizada por objetivos estratégicos
export const navigationGroups: NavGroup[] = [
  {
    id: 'overview',
    name: 'Visão Geral',
    icon: LayoutDashboard,
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'secretaria', 'gestor_unidade'] },
      { name: 'Pendências', href: '/pendencias', icon: AlertCircle, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
    ],
  },
  {
    id: 'prestacao-contas',
    name: 'Prestação de Contas',
    icon: FileText,
    items: [
      { name: 'Rel. Fechamentos', href: '/reports/cash-closings', icon: FileBarChart, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
      { name: 'Rel. Fecham. LIS', href: '/reports/lis-closures', icon: FileBarChart, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
      { name: 'Rel. Transações', href: '/reports/transactions', icon: FileBarChart, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
    ],
  },
  {
    id: 'caixa-unidades',
    name: 'Caixa & Unidades',
    icon: Wallet,
    badgeKey: 'caixaUnidades',
    items: [
      { name: 'Fechamento de Caixa', href: '/cash-closing', icon: Wallet, roles: ['admin', 'secretaria', 'gestor_unidade'] },
      { name: 'Fechamento LIS', href: '/lis/fechamento', icon: FileUp, roles: ['admin', 'secretaria', 'gestor_unidade'] },
      { name: 'Transações', href: '/transactions', icon: Receipt, roles: ['admin', 'secretaria', 'contabilidade', 'gestor_unidade'] },
      { name: 'Importar LIS', href: '/import/daily-movement', icon: FileUp, roles: ['admin', 'secretaria', 'gestor_unidade'] },
      { name: 'Importar Extrato', href: '/import/bank-statement', icon: FileUp, roles: ['admin', 'secretaria', 'gestor_unidade'] },
      { name: 'Unidades', href: '/settings/units', icon: MapPin, roles: ['admin'] },
      { name: 'Contas', href: '/settings/accounts', icon: Building2, roles: ['admin'] },
    ],
  },
  {
    id: 'tributacao-cenarios',
    name: 'Tributação & Cenários',
    icon: Calculator,
    badgeKey: 'tributacao',
    items: [
      { name: 'Cenários Tributários', href: '/reports/tax-scenarios', icon: Calculator, roles: ['admin', 'contabilidade'] },
      { name: 'Fluxo de Caixa', href: '/reports/cashflow-projection', icon: TrendingUp, roles: ['admin', 'contabilidade'] },
      { name: 'Patrimônio', href: '/reports/patrimony', icon: Building2, roles: ['admin', 'contabilidade'] },
      { name: 'Config. Tributária', href: '/settings/tax-config', icon: Settings, roles: ['admin'] },
    ],
  },
  {
    id: 'faturamento',
    name: 'Faturamento',
    icon: FileText,
    items: [
      { name: 'Notas Fiscais', href: '/billing/invoices', icon: FileText, roles: ['admin', 'contabilidade'] },
      { name: 'Convênios', href: '/billing/payers', icon: Handshake, roles: ['admin', 'contabilidade'] },
      { name: 'Resumo Mensal', href: '/billing/summary', icon: TrendingUp, roles: ['admin', 'contabilidade'] },
    ],
  },
  {
    id: 'contas-pagar',
    name: 'Contas a Pagar',
    icon: CreditCard,
    items: [
      { name: 'Dashboard', href: '/payables/dashboard', icon: LayoutDashboard, roles: ['admin', 'contabilidade'] },
      { name: 'Notas Fornecedor', href: '/payables/supplier-invoices', icon: FileInput, roles: ['admin', 'contabilidade'] },
      { name: 'Boletos', href: '/payables/boletos', icon: Barcode, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
      { name: 'Conciliação', href: '/payables/reconciliation', icon: GitMerge, roles: ['admin', 'contabilidade'] },
    ],
  },
  {
    id: 'lucratividade',
    name: 'Lucratividade & Custos',
    icon: TrendingUp,
    badgeKey: 'lucratividade',
    items: [
      { name: 'Categorias', href: '/settings/categories', icon: Tags, roles: ['admin'] },
      { name: 'Parceiros', href: '/settings/partners', icon: Handshake, roles: ['admin'] },
    ],
  },
  {
    id: 'risco-estrategia',
    name: 'Risco & Estratégia',
    icon: ShieldAlert,
    badgeKey: 'riscoEstrategia',
    items: [
      { name: 'Povoação 2025', href: '/settings/data-2025', icon: Database, roles: ['admin', 'contabilidade'] },
      { name: 'Real x Oficial', href: '/reports/personnel-real-vs-official', icon: Users, roles: ['admin'] },
      { name: 'Auditoria Fator R', href: '/settings/fator-r-audit', icon: Calculator, roles: ['admin', 'contabilidade'] },
      { name: 'Alertas', href: '/settings/alerts', icon: Bell, roles: ['admin'] },
      { name: 'Usuários', href: '/settings/users', icon: Users, roles: ['admin'] },
    ],
  },
  {
    id: 'sistema',
    name: 'Sistema',
    icon: Cog,
    items: [
      { name: 'Sobre', href: '/about', icon: Info, roles: ['admin', 'contabilidade', 'gestor_unidade', 'secretaria'] },
      { name: 'Changelog', href: '/changelog', icon: History, roles: ['admin', 'contabilidade', 'gestor_unidade', 'secretaria'] },
    ],
  },
];
