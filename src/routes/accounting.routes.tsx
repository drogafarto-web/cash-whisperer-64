import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import {
  AccountingPanel,
  AccountingBankStatements,
  AccountingHistory,
  AccountingAudit,
} from './LazyComponents';

/**
 * Rotas de Contabilidade
 * Roles: contabilidade, contador, admin
 */
const accountingRoles = ['admin', 'contabilidade', 'contador'] as const;

export const accountingRoutes: RouteObject[] = [
  // Nova URL hierárquica
  {
    path: '/accounting',
    element: (
      <ProtectedRoute roles={[...accountingRoles]}>
        <AccountingPanel />
      </ProtectedRoute>
    ),
  },
  // Redirect da URL antiga
  {
    path: '/accounting-panel',
    element: <Navigate to="/accounting" replace />,
  },
  {
    path: '/accounting/bank-statements',
    element: (
      <ProtectedRoute roles={[...accountingRoles]}>
        <AccountingBankStatements />
      </ProtectedRoute>
    ),
  },
  // Nova URL hierárquica
  {
    path: '/accounting/history',
    element: (
      <ProtectedRoute roles={[...accountingRoles]}>
        <AccountingHistory />
      </ProtectedRoute>
    ),
  },
  // Redirect da URL antiga
  {
    path: '/accounting-history',
    element: <Navigate to="/accounting/history" replace />,
  },
  // Nova URL hierárquica
  {
    path: '/accounting/audit',
    element: (
      <ProtectedRoute roles={[...accountingRoles]}>
        <AccountingAudit />
      </ProtectedRoute>
    ),
  },
  // Redirect da URL antiga
  {
    path: '/accounting-audit',
    element: <Navigate to="/accounting/audit" replace />,
  },
];
