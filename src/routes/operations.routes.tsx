import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import {
  Transactions,
  CashClosingSimple,
  EnvelopeCashClosing,
  Pendencias,
  ReceptionPanel,
} from './LazyComponents';

/**
 * Rotas operacionais - caixa, recepção, lançamentos
 */
export const operationsRoutes: RouteObject[] = [
  // Lançamentos
  {
    path: '/transactions',
    element: (
      <ProtectedRoute roles={['admin', 'secretaria', 'contabilidade', 'gestor_unidade', 'financeiro']}>
        <Transactions />
      </ProtectedRoute>
    ),
  },
  // Fechamento de Caixa
  {
    path: '/cash-closing',
    element: (
      <ProtectedRoute 
        roles={['admin', 'secretaria', 'gestor_unidade']}
        functions={['caixa', 'supervisao']}
      >
        <CashClosingSimple />
      </ProtectedRoute>
    ),
  },
  // Fechamento Envelope
  {
    path: '/envelope-closing',
    element: (
      <ProtectedRoute 
        roles={['admin', 'secretaria', 'gestor_unidade']}
        functions={['caixa', 'supervisao']}
      >
        <EnvelopeCashClosing />
      </ProtectedRoute>
    ),
  },
  // Pendências (URL padronizada para inglês)
  {
    path: '/pending-items',
    element: (
      <ProtectedRoute roles={['admin', 'secretaria', 'gestor_unidade', 'financeiro']}>
        <Pendencias />
      </ProtectedRoute>
    ),
  },
  // Redirect da URL antiga
  {
    path: '/pendencias',
    element: <Navigate to="/pending-items" replace />,
  },
  // Painel de Recepção
  {
    path: '/reception-panel',
    element: (
      <ProtectedRoute 
        roles={['admin', 'secretaria', 'gestor_unidade']}
        functions={['atendimento', 'caixa']}
      >
        <ReceptionPanel />
      </ProtectedRoute>
    ),
  },
];
