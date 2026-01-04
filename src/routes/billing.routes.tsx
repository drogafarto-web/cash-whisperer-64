import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import {
  Invoices,
  Payers,
  BillingSummary,
} from './LazyComponents';

/**
 * Rotas de Faturamento (Receitas)
 * Roles: contabilidade, financeiro, admin
 */
const billingRoles = ['admin', 'contabilidade', 'financeiro'] as const;

export const billingRoutes: RouteObject[] = [
  {
    path: '/billing/invoices',
    element: (
      <ProtectedRoute roles={[...billingRoles]}>
        <Invoices />
      </ProtectedRoute>
    ),
  },
  {
    path: '/billing/payers',
    element: (
      <ProtectedRoute roles={[...billingRoles]}>
        <Payers />
      </ProtectedRoute>
    ),
  },
  {
    path: '/billing/summary',
    element: (
      <ProtectedRoute roles={[...billingRoles]}>
        <BillingSummary />
      </ProtectedRoute>
    ),
  },
];
