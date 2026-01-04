import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { Dashboard } from './LazyComponents';

/**
 * Rotas do Dashboard - acessível a todos os usuários autenticados
 */
export const dashboardRoutes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
];
