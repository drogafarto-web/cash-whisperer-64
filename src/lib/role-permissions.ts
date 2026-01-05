import { AppRole } from '@/types/database';
import { OperationalFunction } from '@/hooks/useAuth';

/**
 * ROLE_IMPLICIT_FUNCTIONS
 * 
 * Mapeia cada role para suas funções operacionais implícitas.
 * Isso evita a necessidade de atribuir functions manualmente para cada usuário.
 * 
 * O usuário SEMPRE pode ter functions adicionais via profile_functions no BD.
 */
export const ROLE_IMPLICIT_FUNCTIONS: Record<AppRole, OperationalFunction[]> = {
  admin: ['atendimento', 'coleta', 'caixa', 'supervisao', 'tecnico'],
  
  // Secretaria = Atendente: opera quiosque + caixa
  secretaria: ['atendimento', 'caixa'],
  
  // Gestor de Unidade: supervisiona tudo na unidade
  gestor_unidade: ['atendimento', 'caixa', 'supervisao'],
  
  // Financeiro: não opera caixa físico, mas pode supervisionar
  financeiro: ['supervisao'],
  
  // Contabilidade: acesso consultivo, sem operação de caixa
  contabilidade: [],
  
  // Contador externo: acesso apenas fiscal
  contador: [],
};

/**
 * ROLE_ROUTE_ACCESS
 * 
 * Define quais rotas cada role pode acessar.
 * Usado para validação e construção de menus.
 */
export const ROLE_ROUTE_ACCESS: Record<AppRole, string[]> = {
  admin: ['*'], // Acesso total
  
  secretaria: [
    '/dashboard',
    '/reception-panel',
    '/transactions',
    '/cash-closing',
    '/lis/fechamento',
    '/envelope-closing',
    '/import/daily-movement',
    '/pendencias',
    '/payables/boletos',
  ],
  
  gestor_unidade: [
    '/dashboard',
    '/reception-panel',
    '/transactions',
    '/cash-closing',
    '/lis/fechamento',
    '/envelope-closing',
    '/import/daily-movement',
    '/import/bank-statement',
    '/payables/boletos',
    '/reports/cash-closings',
    '/reports/lis-closures',
    '/pendencias',
    '/accounting-panel',
  ],
  
  financeiro: [
    '/dashboard',
    '/transactions',
    '/payables/boletos',
    '/payables/supplier-invoices',
    '/payables/tax-documents',
    '/core/despesas',
    '/import/bank-statement',
    '/reports/cashflow-projection',
    '/accounting-panel',
    '/pendencias',
  ],
  
  contabilidade: [
    '/dashboard',
    '/transactions',
    '/billing/invoices',
    '/billing/payers',
    '/billing/summary',
    '/payables/boletos',
    '/payables/supplier-invoices',
    '/payables/tax-documents',
    '/core/despesas',
    '/reports/cash-closings',
    '/reports/transactions',
    '/reports/tax-scenarios',
    '/reports/patrimony',
    '/reports/cashflow-projection',
    '/accounting-panel',
    '/accounting-history',
    '/accounting-audit',
    '/pendencias',
  ],
  
  contador: [
    '/dashboard',
    '/accounting-panel',
    '/accounting-history',
    '/accounting-audit',
    '/accounting/bank-statements',
    '/settings/fiscal-base',
    '/settings/data-2025',
    '/reports/tax-scenarios',
    '/settings/fator-r-audit',
    '/pendencias',
  ],
};

/**
 * Verifica se um role pode acessar uma rota específica
 */
export function canAccessRoute(role: AppRole | null, path: string): boolean {
  if (!role) return false;
  
  const allowedRoutes = ROLE_ROUTE_ACCESS[role];
  if (!allowedRoutes) return false;
  
  // Admin tem acesso total
  if (allowedRoutes.includes('*')) return true;
  
  // Verificação exata ou por prefixo
  return allowedRoutes.some(route => 
    path === route || path.startsWith(route + '/')
  );
}

/**
 * Retorna as funções operacionais implícitas de um role
 */
export function getImplicitFunctions(role: AppRole | null): OperationalFunction[] {
  if (!role) return [];
  return ROLE_IMPLICIT_FUNCTIONS[role] || [];
}

/**
 * Verifica se um role tem uma função (implícita ou não)
 * Nota: Para verificar functions explícitas + implícitas, use useAuth().hasFunction()
 */
export function roleHasFunction(role: AppRole | null, fn: OperationalFunction): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  return ROLE_IMPLICIT_FUNCTIONS[role]?.includes(fn) ?? false;
}
