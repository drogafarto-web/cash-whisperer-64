import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, OperationalFunction } from '@/hooks/useAuth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RequireFunctionProps {
  /** Functions that grant access - user needs at least one */
  functions: OperationalFunction[];
  /** What to render when access is granted */
  children: ReactNode;
  /** Custom redirect path when access denied (default: show message) */
  redirectTo?: string;
  /** Custom message when access denied */
  deniedMessage?: string;
}

/**
 * RequireFunction - Wrapper component that protects content based on operational functions
 * 
 * Usage:
 * <RequireFunction functions={['caixa', 'supervisao']}>
 *   <CashClosingPage />
 * </RequireFunction>
 */
export function RequireFunction({
  functions,
  children,
  redirectTo,
  deniedMessage,
}: RequireFunctionProps) {
  const { user, isLoading, hasFunction, isAdmin } = useAuth();

  // Still loading - show nothing to prevent flash
  if (isLoading) {
    return null;
  }

  // Not authenticated - redirect to login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin always has access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check if user has any of the required functions
  const hasAccess = functions.some(fn => hasFunction(fn));

  if (!hasAccess) {
    // If redirect specified, navigate there
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    // Otherwise show access denied message
    const functionLabels: Record<OperationalFunction, string> = {
      atendimento: 'Atendimento',
      coleta: 'Coleta',
      caixa: 'Caixa',
      supervisao: 'Supervisão',
      tecnico: 'Técnico',
    };

    const requiredLabels = functions.map(fn => functionLabels[fn]).join(' ou ');

    return (
      <div className="container mx-auto py-8 px-4 max-w-lg">
        <Alert variant="destructive">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Acesso Restrito</AlertTitle>
          <AlertDescription className="mt-2">
            {deniedMessage || (
              <>
                Você precisa da função <strong>{requiredLabels}</strong> para acessar esta tela.
                <br />
                Solicite ao administrador a atribuição da função necessária.
              </>
            )}
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to check function access programmatically
 */
export function useRequireFunction(functions: OperationalFunction[]): {
  hasAccess: boolean;
  isLoading: boolean;
} {
  const { isLoading, hasFunction, isAdmin } = useAuth();

  if (isLoading) {
    return { hasAccess: false, isLoading: true };
  }

  if (isAdmin) {
    return { hasAccess: true, isLoading: false };
  }

  const hasAccess = functions.some(fn => hasFunction(fn));
  return { hasAccess, isLoading: false };
}
