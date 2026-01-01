import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppRole } from '@/types/database';
import { ROLE_CONFIG } from '@/lib/access-policy';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RequireRoleProps {
  /** Roles que podem acessar - usuário precisa ter pelo menos uma */
  roles: AppRole[];
  /** Conteúdo a renderizar quando acesso é permitido */
  children: ReactNode;
  /** Rota de redirecionamento quando acesso negado (padrão: mostra mensagem) */
  redirectTo?: string;
  /** Mensagem customizada quando acesso negado */
  deniedMessage?: string;
}

/**
 * RequireRole - Wrapper que protege conteúdo baseado no role do usuário
 * 
 * Uso:
 * <RequireRole roles={['admin', 'secretaria', 'gestor_unidade']}>
 *   <QuiosquePage />
 * </RequireRole>
 * 
 * Diferente de RequireFunction, este componente verifica o ROLE do usuário,
 * não as funções operacionais. Use RequireRole para controle de acesso a páginas
 * e RequireFunction para verificar capacidades específicas dentro de uma página.
 */
export function RequireRole({
  roles,
  children,
  redirectTo,
  deniedMessage,
}: RequireRoleProps) {
  const { user, isLoading, role, isAdmin } = useAuth();

  // Spinner enquanto autentica
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Não autenticado - redireciona para login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin sempre tem acesso
  if (isAdmin) {
    return <>{children}</>;
  }

  // Verifica se o role do usuário está na lista permitida
  const hasAccess = role ? roles.includes(role) : false;

  if (!hasAccess) {
    // Se redirect especificado, navega para lá
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    // Caso contrário, mostra mensagem de acesso negado
    const roleLabels = roles
      .map(r => ROLE_CONFIG[r]?.label || r)
      .join(' ou ');

    return (
      <div className="container mx-auto py-8 px-4 max-w-lg">
        <Alert variant="destructive">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Acesso Restrito</AlertTitle>
          <AlertDescription className="mt-2">
            {deniedMessage || (
              <>
                Esta página é restrita para usuários com perfil{' '}
                <strong>{roleLabels}</strong>.
                <br />
                Seu perfil atual é:{' '}
                <strong>{role ? ROLE_CONFIG[role]?.label : 'Não definido'}</strong>.
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
 * Hook para verificar acesso por role programaticamente
 */
export function useRequireRole(roles: AppRole[]): {
  hasAccess: boolean;
  isLoading: boolean;
  currentRole: AppRole | null;
} {
  const { isLoading, role, isAdmin } = useAuth();

  if (isLoading) {
    return { hasAccess: false, isLoading: true, currentRole: null };
  }

  if (isAdmin) {
    return { hasAccess: true, isLoading: false, currentRole: role };
  }

  const hasAccess = role ? roles.includes(role) : false;
  return { hasAccess, isLoading: false, currentRole: role };
}
