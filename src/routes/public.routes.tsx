import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import {
  Auth,
  ResetPassword,
  AccountingForm,
  NotFound,
  About,
  Changelog,
} from './LazyComponents';

/**
 * Rotas públicas - não requerem autenticação
 */
export const publicRoutes: RouteObject[] = [
  {
    path: '/auth',
    element: (
      <ProtectedRoute isPublic>
        <Auth />
      </ProtectedRoute>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <ProtectedRoute isPublic>
        <ResetPassword />
      </ProtectedRoute>
    ),
  },
  // Formulário externo do contador (token público)
  {
    path: '/accounting/form/:token',
    element: (
      <ProtectedRoute isPublic>
        <AccountingForm />
      </ProtectedRoute>
    ),
  },
  // Rota legada - redirect para nova URL
  {
    path: '/contabilidade/dados/:token',
    element: (
      <ProtectedRoute isPublic>
        <AccountingForm />
      </ProtectedRoute>
    ),
  },
  // Sistema
  {
    path: '/about',
    element: (
      <ProtectedRoute>
        <About />
      </ProtectedRoute>
    ),
  },
  {
    path: '/changelog',
    element: (
      <ProtectedRoute>
        <Changelog />
      </ProtectedRoute>
    ),
  },
  // Catch-all
  {
    path: '*',
    element: <NotFound />,
  },
];
