import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, OperationalFunction } from '@/hooks/useAuth';
import { AppRole } from '@/types/database';
import { ROLE_CONFIG } from '@/lib/access-policy';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  /** Conteúdo a renderizar quando acesso é permitido */
  children: ReactNode;
  /** Roles que podem acessar - usuário precisa ter pelo menos uma (OR) */
  roles?: AppRole[];
  /** Funções operacionais permitidas (OR) */
  functions?: OperationalFunction[];
  /** Se true, requer AMBOS roles E functions (AND). Padrão: false (OR) */
  requireAll?: boolean;
  /** Rota de redirecionamento quando acesso negado */
  redirectTo?: string;
  /** Mensagem customizada quando acesso negado */
  deniedMessage?: string;
  /** Se true, permite acesso público (sem autenticação) */
  isPublic?: boolean;
}

/**
 * ProtectedRoute - Componente unificado para proteção de rotas
 * 
 * Combina verificação de:
 * - Autenticação (redireciona para /auth se não logado)
 * - Autorização por roles (ex: admin, financeiro)
 * - Autorização por functions (ex: caixa, supervisao)
 * 
 * Admin sempre tem acesso total.
 */
export function ProtectedRoute({
  children,
  roles,
  functions,
  requireAll = false,
  redirectTo,
  deniedMessage,
  isPublic = false,
}: ProtectedRouteProps) {
  const { user, isLoading, role, isAdmin, hasFunction } = useAuth();
  const location = useLocation();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Rota pública - permite acesso sem autenticação
  if (isPublic) {
    return <>{children}</>;
  }

  // Não autenticado - redireciona para login
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Admin sempre tem acesso
  if (isAdmin) {
    return <>{children}</>;
  }

  // Se não há restrições de role ou function, apenas autenticação é necessária
  if (!roles?.length && !functions?.length) {
    return <>{children}</>;
  }

  // Verifica acesso por role
  const hasRoleAccess = !roles?.length || (role ? roles.includes(role) : false);

  // Verifica acesso por function
  const hasFunctionAccess = !functions?.length || functions.some(fn => hasFunction(fn));

  // Determina acesso final baseado em requireAll
  const hasAccess = requireAll
    ? hasRoleAccess && hasFunctionAccess
    : hasRoleAccess || hasFunctionAccess;

  if (!hasAccess) {
    // Se redirect especificado, navega para lá
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    // Mensagem de acesso negado
    const roleLabels = roles
      ?.map(r => ROLE_CONFIG[r]?.label || r)
      .join(' ou ') || '';

    const functionLabels = functions?.join(' ou ') || '';

    return (
      <div className="container mx-auto py-8 px-4 max-w-lg">
        <Alert variant="destructive">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Acesso Restrito</AlertTitle>
          <AlertDescription className="mt-2">
            {deniedMessage || (
              <>
                {roles?.length ? (
                  <>
                    Esta página é restrita para usuários com perfil{' '}
                    <strong>{roleLabels}</strong>.
                  </>
                ) : null}
                {functions?.length ? (
                  <>
                    {roles?.length ? ' Ou ' : 'Esta página requer '}
                    função <strong>{functionLabels}</strong>.
                  </>
                ) : null}
                <br />
                <span className="text-sm opacity-80">
                  Seu perfil atual: {role ? ROLE_CONFIG[role]?.label : 'Não definido'}
                </span>
              </>
            )}
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => window.history.back()}>
            Voltar
          </Button>
          <Button variant="ghost" asChild>
            <a href="/dashboard">Ir para Dashboard</a>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
