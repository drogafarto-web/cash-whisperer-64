import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';

// Import all route modules
import { publicRoutes } from './public.routes';
import { dashboardRoutes } from './dashboard.routes';
import { operationsRoutes } from './operations.routes';
import { payablesRoutes } from './payables.routes';
import { billingRoutes } from './billing.routes';
import { accountingRoutes } from './accounting.routes';
import { reportsRoutes } from './reports.routes';
import { settingsRoutes } from './settings.routes';
import { importRoutes } from './import.routes';
import { kioskRoutes } from './kiosk.routes';

/**
 * Router central - compõe todas as rotas modulares
 * 
 * Usa createBrowserRouter do React Router v6.4+ para:
 * - Melhor performance com data loading
 * - Suporte a lazy loading nativo
 * - Error boundaries por rota
 */
export const router = createBrowserRouter([
  {
    // Root layout com AuthProvider
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      // Ordem importa para matching - mais específico primeiro
      ...dashboardRoutes,
      ...operationsRoutes,
      ...payablesRoutes,
      ...billingRoutes,
      ...accountingRoutes,
      ...reportsRoutes,
      ...settingsRoutes,
      ...importRoutes,
      ...kioskRoutes,
      // Public routes por último (inclui catch-all)
      ...publicRoutes,
    ],
  },
]);

// Re-export route modules for testing/documentation
export {
  publicRoutes,
  dashboardRoutes,
  operationsRoutes,
  payablesRoutes,
  billingRoutes,
  accountingRoutes,
  reportsRoutes,
  settingsRoutes,
  importRoutes,
  kioskRoutes,
};
