import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import {
  Boletos,
  SupplierInvoices,
  TaxDocuments,
  PayablesDashboard,
  BulkManagement,
  PayablesReconciliation,
} from './LazyComponents';

/**
 * Rotas de Contas a Pagar (Despesas)
 * Roles: financeiro, contabilidade, gestor_unidade, admin
 */
const payablesRoles = ['admin', 'financeiro', 'contabilidade', 'gestor_unidade'] as const;

export const payablesRoutes: RouteObject[] = [
  {
    path: '/payables/boletos',
    element: (
      <ProtectedRoute roles={[...payablesRoles]}>
        <Boletos />
      </ProtectedRoute>
    ),
  },
  {
    path: '/payables/supplier-invoices',
    element: (
      <ProtectedRoute roles={[...payablesRoles]}>
        <SupplierInvoices />
      </ProtectedRoute>
    ),
  },
  {
    path: '/payables/tax-documents',
    element: (
      <ProtectedRoute roles={[...payablesRoles]}>
        <TaxDocuments />
      </ProtectedRoute>
    ),
  },
  {
    path: '/payables/dashboard',
    element: (
      <ProtectedRoute roles={[...payablesRoles]}>
        <PayablesDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/payables/bulk-management',
    element: (
      <ProtectedRoute roles={[...payablesRoles]}>
        <BulkManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/payables/reconciliation',
    element: (
      <ProtectedRoute roles={[...payablesRoles]}>
        <PayablesReconciliation />
      </ProtectedRoute>
    ),
  },
];
