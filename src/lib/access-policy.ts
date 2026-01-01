import { AppRole } from '@/types/database';
import { LucideIcon, Shield, User, Building2, Calculator, FileSpreadsheet, Users } from 'lucide-react';

// Re-export AppRole for convenience
export type { AppRole };

// Áreas do sistema para matriz de permissões
export type SystemArea = 
  | 'dashboard'
  | 'transactions'
  | 'cash_closing'
  | 'lis_closing'
  | 'imports'
  | 'reports'
  | 'billing'
  | 'payables'
  | 'fiscal_base'
  | 'tax_config'
  | 'users'
  | 'settings'
  | 'units'
  | 'accounts'
  | 'categories'
  | 'partners'
  | 'tax_scenarios'
  | 'fator_r_audit'
  | 'patrimony'
  | 'cashflow'
  | 'accounting_panel'
  | 'accounting_audit';

// Permissões possíveis
export type PermissionLevel = 'none' | 'view' | 'edit' | 'full';

// Matriz de permissões centralizada
export const ROLE_PERMISSIONS: Record<AppRole, Record<SystemArea, PermissionLevel>> = {
  admin: {
    dashboard: 'full',
    transactions: 'full',
    cash_closing: 'full',
    lis_closing: 'full',
    imports: 'full',
    reports: 'full',
    billing: 'full',
    payables: 'full',
    fiscal_base: 'full',
    tax_config: 'full',
    users: 'full',
    settings: 'full',
    units: 'full',
    accounts: 'full',
    categories: 'full',
    partners: 'full',
    tax_scenarios: 'full',
    fator_r_audit: 'full',
    patrimony: 'full',
    cashflow: 'full',
    accounting_panel: 'full',
    accounting_audit: 'full',
  },
  contador: {
    dashboard: 'view',
    transactions: 'view',
    cash_closing: 'none',
    lis_closing: 'none',
    imports: 'none',
    reports: 'view',
    billing: 'none',
    payables: 'none',
    fiscal_base: 'full',
    tax_config: 'none',
    users: 'none',
    settings: 'none',
    units: 'none',
    accounts: 'none',
    categories: 'none',
    partners: 'none',
    tax_scenarios: 'full',
    fator_r_audit: 'full',
    patrimony: 'none',
    cashflow: 'none',
    accounting_panel: 'full',
    accounting_audit: 'full',
  },
  contabilidade: {
    dashboard: 'view',
    transactions: 'view',
    cash_closing: 'none',
    lis_closing: 'none',
    imports: 'none',
    reports: 'full',
    billing: 'full',
    payables: 'full',
    fiscal_base: 'none',
    tax_config: 'none',
    users: 'none',
    settings: 'none',
    units: 'none',
    accounts: 'none',
    categories: 'none',
    partners: 'none',
    tax_scenarios: 'full',
    fator_r_audit: 'view',
    patrimony: 'full',
    cashflow: 'full',
    accounting_panel: 'full',
    accounting_audit: 'view',
  },
  financeiro: {
    dashboard: 'view',
    transactions: 'full',
    cash_closing: 'none',
    lis_closing: 'none',
    imports: 'full',
    reports: 'view',
    billing: 'view',
    payables: 'full',
    fiscal_base: 'none',
    tax_config: 'none',
    users: 'none',
    settings: 'none',
    units: 'none',
    accounts: 'none',
    categories: 'none',
    partners: 'none',
    tax_scenarios: 'none',
    fator_r_audit: 'none',
    patrimony: 'none',
    cashflow: 'view',
    accounting_panel: 'edit',
    accounting_audit: 'none',
  },
  gestor_unidade: {
    dashboard: 'view',
    transactions: 'full',
    cash_closing: 'full',
    lis_closing: 'full',
    imports: 'full',
    reports: 'view',
    billing: 'none',
    payables: 'view',
    fiscal_base: 'none',
    tax_config: 'none',
    users: 'none',
    settings: 'none',
    units: 'none',
    accounts: 'none',
    categories: 'none',
    partners: 'none',
    tax_scenarios: 'none',
    fator_r_audit: 'none',
    patrimony: 'none',
    cashflow: 'none',
    accounting_panel: 'edit',
    accounting_audit: 'none',
  },
  secretaria: {
    dashboard: 'view',
    transactions: 'full',
    cash_closing: 'full',
    lis_closing: 'full',
    imports: 'full',
    reports: 'none',
    billing: 'none',
    payables: 'none',
    fiscal_base: 'none',
    tax_config: 'none',
    users: 'none',
    settings: 'none',
    units: 'none',
    accounts: 'none',
    categories: 'none',
    partners: 'none',
    tax_scenarios: 'none',
    fator_r_audit: 'none',
    patrimony: 'none',
    cashflow: 'none',
    accounting_panel: 'edit',
    accounting_audit: 'none',
  },
};

// Configuração de papéis com metadados
export const ROLE_CONFIG: Record<AppRole, {
  label: string;
  description: string;
  variant: 'default' | 'secondary' | 'outline';
  requiresUnit: boolean;
  isOperational: boolean;
  icon: LucideIcon;
}> = {
  admin: {
    label: 'Administrador',
    description: 'Acesso total: todos os módulos e configurações',
    variant: 'default',
    requiresUnit: false,
    isOperational: false,
    icon: Shield,
  },
  contador: {
    label: 'Contador/Consultor',
    description: 'Impostos, Fator R, folha e parâmetros fiscais',
    variant: 'secondary',
    requiresUnit: false,
    isOperational: false,
    icon: Users,
  },
  contabilidade: {
    label: 'Contabilidade',
    description: 'Relatórios, DRE, faturamento e exportações fiscais',
    variant: 'secondary',
    requiresUnit: false,
    isOperational: false,
    icon: FileSpreadsheet,
  },
  financeiro: {
    label: 'Financeiro',
    description: 'Boletos, NFs de fornecedor e conciliação bancária',
    variant: 'secondary',
    requiresUnit: false,
    isOperational: true,
    icon: Calculator,
  },
  gestor_unidade: {
    label: 'Gestor de Unidade',
    description: 'Supervisiona a unidade: caixa, despesas e relatórios',
    variant: 'secondary',
    requiresUnit: true,
    isOperational: true,
    icon: Building2,
  },
  secretaria: {
    label: 'Atendente',
    description: 'Quiosque, lançamentos rápidos e fechamento de caixa',
    variant: 'outline',
    requiresUnit: true,
    isOperational: true,
    icon: User,
  },
};

// Labels das áreas para exibição
export const AREA_LABELS: Record<SystemArea, string> = {
  dashboard: 'Dashboard',
  transactions: 'Transações',
  cash_closing: 'Fechamento Caixa',
  lis_closing: 'Fechamento LIS',
  imports: 'Importações',
  reports: 'Relatórios',
  billing: 'Faturamento',
  payables: 'Contas a Pagar',
  fiscal_base: 'Base Fiscal',
  tax_config: 'Config. Tributária',
  users: 'Usuários',
  settings: 'Configurações',
  units: 'Unidades',
  accounts: 'Contas',
  categories: 'Categorias',
  partners: 'Parceiros',
  tax_scenarios: 'Cenários Tributários',
  fator_r_audit: 'Auditoria Fator R',
  patrimony: 'Patrimônio',
  cashflow: 'Fluxo de Caixa',
  accounting_panel: 'Painel Contabilidade',
  accounting_audit: 'Auditoria Contábil',
};

// Áreas agrupadas para exibição no guia de papéis
export const AREA_GROUPS = {
  operacional: ['dashboard', 'transactions', 'cash_closing', 'lis_closing', 'imports'] as SystemArea[],
  relatorios: ['reports', 'billing', 'payables'] as SystemArea[],
  fiscal: ['fiscal_base', 'tax_config', 'tax_scenarios', 'fator_r_audit'] as SystemArea[],
  admin: ['users', 'settings', 'units', 'accounts', 'categories', 'partners'] as SystemArea[],
};

// Funções auxiliares
export function canAccess(role: AppRole | null, area: SystemArea): boolean {
  if (!role) return false;
  const permission = ROLE_PERMISSIONS[role]?.[area];
  return permission !== 'none' && permission !== undefined;
}

export function canEdit(role: AppRole | null, area: SystemArea): boolean {
  if (!role) return false;
  const permission = ROLE_PERMISSIONS[role]?.[area];
  return permission === 'edit' || permission === 'full';
}

export function canPerform(role: AppRole | null, action: string): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  
  // Mapeamento de ações para áreas
  const actionToArea: Record<string, SystemArea> = {
    'view_dashboard': 'dashboard',
    'edit_transactions': 'transactions',
    'close_cash': 'cash_closing',
    'close_lis': 'lis_closing',
    'import_files': 'imports',
    'view_reports': 'reports',
    'manage_billing': 'billing',
    'manage_payables': 'payables',
    'edit_fiscal_base': 'fiscal_base',
    'edit_tax_config': 'tax_config',
    'manage_users': 'users',
    'edit_settings': 'settings',
    'view_tax_scenarios': 'tax_scenarios',
    'audit_fator_r': 'fator_r_audit',
  };
  
  const area = actionToArea[action];
  if (!area) return false;
  
  return canEdit(role, area);
}

export function getPermissionLevel(role: AppRole | null, area: SystemArea): PermissionLevel {
  if (!role) return 'none';
  return ROLE_PERMISSIONS[role]?.[area] ?? 'none';
}

// Rotas permitidas por papel (para navegação)
export function getAllowedRoutes(role: AppRole | null): string[] {
  if (!role) return [];
  if (role === 'admin') return ['*'];
  
  const routes: string[] = [];
  const permissions = ROLE_PERMISSIONS[role];
  
  // Mapear áreas para rotas
  const areaToRoutes: Record<SystemArea, string[]> = {
    dashboard: ['/dashboard'],
    transactions: ['/transactions'],
    cash_closing: ['/cash-closing', '/cash-closing-advanced'],
    lis_closing: ['/lis/fechamento'],
    imports: ['/import/daily-movement', '/import/bank-statement'],
    reports: ['/reports/cash-closings', '/reports/lis-closures', '/reports/transactions'],
    billing: ['/billing/invoices', '/billing/payers', '/billing/summary'],
    payables: ['/payables/dashboard', '/payables/boletos', '/payables/supplier-invoices', '/payables/reconciliation'],
    fiscal_base: ['/settings/fiscal-base', '/settings/data-2025'],
    tax_config: ['/settings/tax-config'],
    users: ['/settings/users'],
    settings: ['/settings/alerts'],
    units: ['/settings/units'],
    accounts: ['/settings/accounts'],
    categories: ['/settings/categories'],
    partners: ['/settings/partners'],
    tax_scenarios: ['/reports/tax-scenarios'],
    fator_r_audit: ['/settings/fator-r-audit'],
    patrimony: ['/reports/patrimony'],
    cashflow: ['/reports/cashflow-projection'],
    accounting_panel: ['/accounting-panel', '/accounting-history'],
    accounting_audit: ['/accounting-audit'],
  };
  
  for (const [area, level] of Object.entries(permissions)) {
    if (level !== 'none') {
      const areaRoutes = areaToRoutes[area as SystemArea];
      if (areaRoutes) {
        routes.push(...areaRoutes);
      }
    }
  }
  
  // Adicionar rotas gerais sempre disponíveis
  routes.push('/about', '/changelog', '/pendencias');
  
  return routes;
}
