import {
  LayoutDashboard,
  Receipt,
  Users,
  Building2,
  Tags,
  AlertCircle,
  MapPin,
  FileBarChart,
  Handshake,
  Calculator,
  Settings,
  FileText,
  CreditCard,
  FileInput,
  Barcode,
  Banknote,
  Info,
  History,
  MonitorSmartphone,
  Shield,
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

/**
 * Navegação Simplificada - 4 grupos principais
 * 
 * Estrutura alinhada com o fluxo:
 * Receita → Despesa → Impostos → Lucro
 */
export const navigationGroups: NavGroup[] = [
  // ============================================
  // GRUPO 1: VISÃO GERAL
  // ============================================
  {
    id: 'overview',
    name: 'Visão Geral',
    icon: LayoutDashboard,
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'secretaria', 'gestor_unidade', 'financeiro', 'contador'] },
      { name: 'Lançamentos', href: '/transactions', icon: Receipt, roles: ['admin', 'secretaria', 'contabilidade', 'gestor_unidade', 'financeiro'] },
      { name: 'Pendências', href: '/pendencias', icon: AlertCircle, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
    ],
  },

  // ============================================
  // GRUPO 2: OPERACIONAL (Receita + Despesa)
  // ============================================
  {
    id: 'operacional',
    name: 'Operacional',
    icon: Banknote,
    items: [
      // Receitas (Faturamento)
      { name: 'Notas Fiscais', href: '/billing/invoices', icon: FileText, roles: ['admin', 'contabilidade'] },
      { name: 'Convênios', href: '/billing/payers', icon: Handshake, roles: ['admin', 'contabilidade'] },
      { name: 'Resumo Faturamento', href: '/billing/summary', icon: FileBarChart, roles: ['admin', 'contabilidade'] },
      // Despesas (Contas a Pagar)
      { name: 'Boletos', href: '/payables/boletos', icon: Barcode, roles: ['admin', 'contabilidade', 'gestor_unidade', 'financeiro'] },
      { name: 'NFs Fornecedor', href: '/payables/supplier-invoices', icon: FileInput, roles: ['admin', 'contabilidade', 'financeiro'] },
      { name: 'Guias Fiscais', href: '/payables/tax-documents', icon: Calculator, roles: ['admin', 'contabilidade', 'financeiro', 'contador'] },
    ],
  },

  // ============================================
  // GRUPO 3: CONTABILIDADE
  // ============================================
  {
    id: 'contabilidade',
    name: 'Contabilidade',
    icon: Calculator,
    items: [
      { name: 'Painel Contábil', href: '/accounting-panel', icon: Calculator, roles: ['admin', 'contabilidade', 'financeiro', 'contador'] },
      { name: 'Histórico', href: '/accounting-history', icon: History, roles: ['admin', 'contabilidade', 'financeiro', 'contador'] },
      { name: 'Auditoria', href: '/accounting-audit', icon: Shield, roles: ['admin', 'contador', 'contabilidade'] },
      { name: 'Painel Recepção', href: '/reception-panel', icon: MonitorSmartphone, roles: ['admin', 'secretaria', 'gestor_unidade'] },
    ],
  },

  // ============================================
  // GRUPO 4: CONFIGURAÇÕES
  // ============================================
  {
    id: 'configuracoes',
    name: 'Configurações',
    icon: Settings,
    items: [
      { name: 'Usuários', href: '/settings/users', icon: Users, roles: ['admin'] },
      { name: 'Unidades', href: '/settings/units', icon: MapPin, roles: ['admin'] },
      { name: 'Contas', href: '/settings/accounts', icon: Building2, roles: ['admin'] },
      { name: 'Categorias', href: '/settings/categories', icon: Tags, roles: ['admin'] },
      { name: 'Sobre', href: '/about', icon: Info, roles: ['admin', 'contabilidade', 'gestor_unidade', 'secretaria'] },
    ],
  },
];

// ============================================
// ARCHIVED NAVIGATION ITEMS
// Para reativar, mova o item de volta para navigationGroups
// ============================================
/*
export const archivedNavigationItems = [
  // Fechamentos de caixa
  { name: 'Central Fechamento', href: '/cash-hub', icon: Banknote, roles: ['admin', 'secretaria', 'gestor_unidade'] },
  { name: 'Importar Movimento', href: '/import/daily-movement', icon: FileUp, roles: ['admin', 'secretaria', 'gestor_unidade'] },
  { name: 'Fechar Envelope', href: '/envelope-closing', icon: Wallet, roles: ['admin', 'secretaria', 'gestor_unidade'] },
  { name: 'Importar Extrato', href: '/import/bank-statement', icon: FileUp, roles: ['admin', 'secretaria', 'gestor_unidade', 'financeiro'] },
  
  // Base Fiscal & Folha
  { name: 'Base Fiscal', href: '/settings/fiscal-base', icon: Calculator, roles: ['admin', 'contador'] },
  { name: 'Povoação 2025', href: '/settings/data-2025', icon: Database, roles: ['admin', 'contador'] },
  { name: 'Configurar Fator R', href: '/settings/fator-r-audit', icon: Settings, roles: ['admin', 'contador'] },
  
  // Tributação & Cenários
  { name: 'Cenários Tributários', href: '/reports/tax-scenarios', icon: Calculator, roles: ['admin', 'contabilidade', 'contador'] },
  { name: 'Fluxo de Caixa', href: '/reports/cashflow-projection', icon: TrendingUp, roles: ['admin', 'contabilidade'] },
  { name: 'Patrimônio', href: '/reports/patrimony', icon: Building2, roles: ['admin', 'contabilidade'] },
  { name: 'Config. Tributária', href: '/settings/tax-config', icon: Settings, roles: ['admin'] },
  
  // Auditorias
  { name: 'Audit. Particular', href: '/audit/particular-vs-cash', icon: ClipboardCheck, roles: ['admin', 'contabilidade', 'financeiro'] },
  { name: 'Audit. Convênio', href: '/audit/convenio-vs-invoice', icon: ClipboardCheck, roles: ['admin', 'contabilidade', 'financeiro'] },
  
  // Relatórios
  { name: 'Rel. Fechamentos', href: '/reports/cash-closings', icon: FileBarChart, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
  { name: 'Rel. Fecham. LIS', href: '/reports/lis-closures', icon: FileBarChart, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
  { name: 'Rel. Transações', href: '/reports/transactions', icon: FileBarChart, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
  { name: 'Real x Oficial', href: '/reports/personnel-real-vs-official', icon: Users, roles: ['admin'] },
  
  // Conciliação
  { name: 'Conciliação', href: '/payables/reconciliation', icon: GitMerge, roles: ['admin', 'contabilidade', 'financeiro'] },
  { name: 'Gestão em Massa', href: '/payables/bulk-management', icon: ListChecks, roles: ['admin', 'contabilidade', 'financeiro'] },
  
  // Lucratividade
  { name: 'Parceiros', href: '/settings/partners', icon: Handshake, roles: ['admin'] },
  
  // Risco
  { name: 'Alertas', href: '/settings/alerts', icon: Bell, roles: ['admin'] },
];
*/
