import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import {
  DailyMovement,
  BankStatement,
  ConvenioReportsImport,
} from './LazyComponents';

/**
 * Rotas de Importação
 * Roles: secretaria, gestor_unidade, financeiro, admin
 */
const importRoles = ['admin', 'secretaria', 'gestor_unidade', 'financeiro'] as const;

export const importRoutes: RouteObject[] = [
  {
    path: '/import/daily-movement',
    element: (
      <ProtectedRoute roles={[...importRoles]}>
        <DailyMovement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/import/bank-statement',
    element: (
      <ProtectedRoute roles={[...importRoles]}>
        <BankStatement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/import/convenio-reports',
    element: (
      <ProtectedRoute roles={[...importRoles]}>
        <ConvenioReportsImport />
      </ProtectedRoute>
    ),
  },
];
