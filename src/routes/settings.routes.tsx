import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import {
  SettingsHub,
  Units,
  Accounts,
  Categories,
  Users,
  Partners,
  TaxConfig,
  FiscalBase,
  FatorRAudit,
  FiscalControl,
} from './LazyComponents';

/**
 * Rotas de Configurações
 */
export const settingsRoutes: RouteObject[] = [
  {
    path: '/settings',
    element: (
      <ProtectedRoute roles={['admin', 'gestor_unidade']}>
        <SettingsHub />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings/units',
    element: (
      <ProtectedRoute roles={['admin']}>
        <Units />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings/accounts',
    element: (
      <ProtectedRoute roles={['admin', 'gestor_unidade', 'financeiro']}>
        <Accounts />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings/categories',
    element: (
      <ProtectedRoute roles={['admin', 'contabilidade']}>
        <Categories />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings/users',
    element: (
      <ProtectedRoute roles={['admin']}>
        <Users />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings/partners',
    element: (
      <ProtectedRoute roles={['admin']}>
        <Partners />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings/tax-config',
    element: (
      <ProtectedRoute roles={['admin', 'contador']}>
        <TaxConfig />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings/fiscal-base',
    element: (
      <ProtectedRoute roles={['admin', 'contador']}>
        <FiscalBase />
      </ProtectedRoute>
    ),
  },
  // Nova URL simplificada
  {
    path: '/settings/fator-r',
    element: (
      <ProtectedRoute roles={['admin', 'contabilidade', 'contador']}>
        <FatorRAudit />
      </ProtectedRoute>
    ),
  },
  // Redirect da URL antiga
  {
    path: '/settings/fator-r-audit',
    element: <Navigate to="/settings/fator-r" replace />,
  },
  // Módulo interno (sem link no menu)
  {
    path: '/settings/internal/fiscal-control',
    element: (
      <ProtectedRoute roles={['admin']}>
        <FiscalControl />
      </ProtectedRoute>
    ),
  },
];
