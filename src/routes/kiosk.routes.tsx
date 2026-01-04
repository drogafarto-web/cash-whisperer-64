import { RouteObject, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { ReceptionPanel, AccountingPanel } from './LazyComponents';

/**
 * Rotas de Modo Quiosque - URLs dedicadas em vez de query strings
 * Acessível por secretaria/atendimento e contabilidade
 */
export const kioskRoutes: RouteObject[] = [
  // Quiosque Recepção (nova URL dedicada)
  {
    path: '/kiosk/reception',
    element: (
      <ProtectedRoute 
        roles={['admin', 'secretaria', 'gestor_unidade']}
        functions={['atendimento', 'caixa']}
      >
        <ReceptionPanel />
      </ProtectedRoute>
    ),
  },
  // Redirect da URL antiga com query string
  {
    path: '/portal/atendimento',
    element: <Navigate to="/kiosk/reception" replace />,
  },
  
  // Quiosque Contabilidade (nova URL dedicada)
  {
    path: '/kiosk/accounting',
    element: (
      <ProtectedRoute roles={['admin', 'contabilidade', 'contador']}>
        <AccountingPanel />
      </ProtectedRoute>
    ),
  },
  // Redirect da URL antiga com query string
  {
    path: '/portal/contabilidade',
    element: <Navigate to="/kiosk/accounting" replace />,
  },
];
