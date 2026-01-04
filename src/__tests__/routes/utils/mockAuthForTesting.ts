import { vi } from 'vitest';
import { AppRole } from '@/types/database';
import { OperationalFunction } from '@/hooks/useAuth';

export interface MockAuthConfig {
  isAuthenticated: boolean;
  role?: AppRole | null;
  functions?: OperationalFunction[];
  isLoading?: boolean;
}

export const AUTH_SCENARIOS: Record<string, MockAuthConfig> = {
  unauthenticated: { isAuthenticated: false },
  admin: { isAuthenticated: true, role: 'admin' },
  secretaria: { isAuthenticated: true, role: 'secretaria' },
  financeiro: { isAuthenticated: true, role: 'financeiro' },
  contador: { isAuthenticated: true, role: 'contador' },
  contabilidade: { isAuthenticated: true, role: 'contabilidade' },
  gestor_unidade: { isAuthenticated: true, role: 'gestor_unidade' },
  secretariaWithCaixa: {
    isAuthenticated: true,
    role: 'secretaria',
    functions: ['caixa'],
  },
  secretariaWithSupervisao: {
    isAuthenticated: true,
    role: 'secretaria',
    functions: ['supervisao'],
  },
  loading: { isAuthenticated: false, isLoading: true },
};

export function createMockAuth(config: MockAuthConfig) {
  const {
    isAuthenticated,
    role = null,
    functions = [],
    isLoading = false,
  } = config;

  return {
    user: isAuthenticated ? { id: 'test-user-id', email: 'test@test.com' } : null,
    session: isAuthenticated ? { access_token: 'mock-token' } : null,
    profile: isAuthenticated ? { id: 'test-user-id', name: 'Test User' } : null,
    role,
    unit: isAuthenticated ? { id: 'unit-1', name: 'Unidade Teste' } : null,
    isLoading,
    isAdmin: role === 'admin',
    isContabilidade: role === 'contabilidade',
    isGestorUnidade: role === 'gestor_unidade',
    isSecretaria: role === 'secretaria',
    isFinanceiro: role === 'financeiro',
    isContador: role === 'contador',
    canAccessAllUnits: ['admin', 'contabilidade', 'financeiro', 'contador'].includes(role || ''),
    hasPermission: vi.fn((permission: string) => role === 'admin'),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    userFunctions: functions,
    userUnits: [],
    activeUnit: isAuthenticated ? { id: 'unit-1', name: 'Unidade Teste' } : null,
    setActiveUnit: vi.fn(),
    hasCashFunction: functions.includes('caixa') || functions.includes('supervisao') || role === 'admin',
    hasFunction: vi.fn((fn: OperationalFunction) => {
      if (role === 'admin') return true;
      return functions.includes(fn);
    }),
  };
}

export function setupAuthMock(config: MockAuthConfig) {
  const mockAuth = createMockAuth(config);
  vi.doMock('@/hooks/useAuth', () => ({
    useAuth: () => mockAuth,
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  }));
  return mockAuth;
}
