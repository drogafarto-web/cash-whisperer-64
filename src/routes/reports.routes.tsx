import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import {
  CashClosingReport,
  TransactionsReport,
  TaxScenarios,
  CashflowProjection,
  LisClosuresReport,
  PersonnelRealVsOfficial,
} from './LazyComponents';

/**
 * Rotas de Relatórios
 */
export const reportsRoutes: RouteObject[] = [
  {
    path: '/reports/cash-closings',
    element: (
      <ProtectedRoute roles={['admin', 'contabilidade', 'gestor_unidade', 'contador']}>
        <CashClosingReport />
      </ProtectedRoute>
    ),
  },
  {
    path: '/reports/transactions',
    element: (
      <ProtectedRoute roles={['admin', 'contabilidade', 'gestor_unidade', 'financeiro', 'contador']}>
        <TransactionsReport />
      </ProtectedRoute>
    ),
  },
  {
    path: '/reports/tax-scenarios',
    element: (
      <ProtectedRoute roles={['admin', 'contabilidade', 'contador']}>
        <TaxScenarios />
      </ProtectedRoute>
    ),
  },
  {
    path: '/reports/cashflow-projection',
    element: (
      <ProtectedRoute roles={['admin', 'contabilidade', 'financeiro', 'contador']}>
        <CashflowProjection />
      </ProtectedRoute>
    ),
  },
  {
    path: '/reports/lis-closures',
    element: (
      <ProtectedRoute roles={['admin', 'contabilidade', 'gestor_unidade', 'contador']}>
        <LisClosuresReport />
      </ProtectedRoute>
    ),
  },
  {
    path: '/reports/personnel-real-vs-official',
    element: (
      <ProtectedRoute roles={['admin', 'contabilidade', 'contador']}>
        <PersonnelRealVsOfficial />
      </ProtectedRoute>
    ),
  },
];
