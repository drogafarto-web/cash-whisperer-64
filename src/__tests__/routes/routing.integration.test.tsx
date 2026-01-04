import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithRouter, waitFor } from './utils/renderWithRouter';
import { setupAuthMock, AUTH_SCENARIOS } from './utils/mockAuthForTesting';

describe('Routing Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ==========================================
  // PUBLIC ROUTES
  // ==========================================
  describe('Rotas Públicas', () => {
    it('deve renderizar /auth sem autenticação', async () => {
      setupAuthMock(AUTH_SCENARIOS.unauthenticated);
      const { container } = renderWithRouter('/auth');

      await waitFor(() => {
        expect(container.textContent).not.toMatch(/acesso restrito/i);
      });
    });

    it('deve renderizar /reset-password sem autenticação', async () => {
      setupAuthMock(AUTH_SCENARIOS.unauthenticated);
      const { container } = renderWithRouter('/reset-password');

      await waitFor(() => {
        expect(container.textContent).not.toMatch(/acesso restrito/i);
      });
    });

    it('deve renderizar /accounting/form/:token sem autenticação', async () => {
      setupAuthMock(AUTH_SCENARIOS.unauthenticated);
      const { container } = renderWithRouter('/accounting/form/abc123-token');

      await waitFor(() => {
        expect(container.textContent).not.toMatch(/acesso restrito/i);
      });
    });
  });

  // ==========================================
  // REDIRECT WITHOUT AUTHENTICATION
  // ==========================================
  describe('Redirecionamento para /auth', () => {
    it('deve redirecionar /dashboard para /auth quando não autenticado', async () => {
      setupAuthMock(AUTH_SCENARIOS.unauthenticated);
      const { router } = renderWithRouter('/dashboard');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth');
      });
    });

    it('deve redirecionar /settings/users para /auth quando não autenticado', async () => {
      setupAuthMock(AUTH_SCENARIOS.unauthenticated);
      const { router } = renderWithRouter('/settings/users');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth');
      });
    });

    it('deve redirecionar /payables/boletos para /auth quando não autenticado', async () => {
      setupAuthMock(AUTH_SCENARIOS.unauthenticated);
      const { router } = renderWithRouter('/payables/boletos');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth');
      });
    });
  });

  // ==========================================
  // ROLE-BASED ACCESS CONTROL
  // ==========================================
  describe('Controle de Acesso por Role', () => {
    it('deve bloquear /settings/users para secretaria (só admin)', async () => {
      setupAuthMock(AUTH_SCENARIOS.secretaria);
      const { container } = renderWithRouter('/settings/users');

      await waitFor(() => {
        expect(container.textContent).toMatch(/acesso restrito/i);
      });
    });

    it('deve bloquear /settings/users para financeiro (só admin)', async () => {
      setupAuthMock(AUTH_SCENARIOS.financeiro);
      const { container } = renderWithRouter('/settings/users');

      await waitFor(() => {
        expect(container.textContent).toMatch(/acesso restrito/i);
      });
    });

    it('deve bloquear /settings/units para secretaria (só admin)', async () => {
      setupAuthMock(AUTH_SCENARIOS.secretaria);
      const { container } = renderWithRouter('/settings/units');

      await waitFor(() => {
        expect(container.textContent).toMatch(/acesso restrito/i);
      });
    });

    it('deve permitir /settings para gestor_unidade', async () => {
      setupAuthMock(AUTH_SCENARIOS.gestor_unidade);
      const { container } = renderWithRouter('/settings');

      await waitFor(() => {
        expect(container.textContent).not.toMatch(/acesso restrito/i);
      });
    });

    it('deve bloquear /billing/invoices para secretaria', async () => {
      setupAuthMock(AUTH_SCENARIOS.secretaria);
      const { container } = renderWithRouter('/billing/invoices');

      await waitFor(() => {
        expect(container.textContent).toMatch(/acesso restrito/i);
      });
    });
  });

  // ==========================================
  // ADMIN ALWAYS HAS ACCESS
  // ==========================================
  describe('Admin - Acesso Total', () => {
    it('admin deve acessar /settings/users', async () => {
      setupAuthMock(AUTH_SCENARIOS.admin);
      const { container } = renderWithRouter('/settings/users');

      await waitFor(() => {
        expect(container.textContent).not.toMatch(/acesso restrito/i);
      });
    });

    it('admin deve acessar /settings/internal/fiscal-control', async () => {
      setupAuthMock(AUTH_SCENARIOS.admin);
      const { container } = renderWithRouter('/settings/internal/fiscal-control');

      await waitFor(() => {
        expect(container.textContent).not.toMatch(/acesso restrito/i);
      });
    });

    it('admin deve acessar /cash-closing (rota com functions)', async () => {
      setupAuthMock(AUTH_SCENARIOS.admin);
      const { container } = renderWithRouter('/cash-closing');

      await waitFor(() => {
        expect(container.textContent).not.toMatch(/acesso restrito/i);
      });
    });
  });

  // ==========================================
  // FUNCTION-BASED ACCESS (OR with roles)
  // ==========================================
  describe('Controle por Functions', () => {
    it('secretaria COM função caixa deve acessar /cash-closing', async () => {
      setupAuthMock(AUTH_SCENARIOS.secretariaWithCaixa);
      const { container } = renderWithRouter('/cash-closing');

      await waitFor(() => {
        expect(container.textContent).not.toMatch(/acesso restrito/i);
      });
    });

    it('secretaria SEM função caixa deve acessar /cash-closing (role aceita)', async () => {
      setupAuthMock(AUTH_SCENARIOS.secretaria);
      const { container } = renderWithRouter('/cash-closing');

      // secretaria is in allowed roles, so it should pass
      await waitFor(() => {
        expect(container.textContent).not.toMatch(/acesso restrito/i);
      });
    });

    it('financeiro sem função caixa NÃO deve acessar /cash-closing', async () => {
      setupAuthMock(AUTH_SCENARIOS.financeiro);
      const { container } = renderWithRouter('/cash-closing');

      await waitFor(() => {
        expect(container.textContent).toMatch(/acesso restrito/i);
      });
    });
  });

  // ==========================================
  // LEGACY URL REDIRECTS
  // ==========================================
  describe('Redirects de URLs Legadas', () => {
    it('deve redirecionar /pendencias → /pending-items', async () => {
      setupAuthMock(AUTH_SCENARIOS.admin);
      const { router } = renderWithRouter('/pendencias');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/pending-items');
      });
    });

    it('deve redirecionar /settings/fator-r-audit → /settings/fator-r', async () => {
      setupAuthMock(AUTH_SCENARIOS.admin);
      const { router } = renderWithRouter('/settings/fator-r-audit');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/settings/fator-r');
      });
    });

    it('deve redirecionar /portal/atendimento → /kiosk/reception', async () => {
      setupAuthMock(AUTH_SCENARIOS.admin);
      const { router } = renderWithRouter('/portal/atendimento');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/kiosk/reception');
      });
    });

    it('deve redirecionar /portal/contabilidade → /kiosk/accounting', async () => {
      setupAuthMock(AUTH_SCENARIOS.admin);
      const { router } = renderWithRouter('/portal/contabilidade');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/kiosk/accounting');
      });
    });
  });

  // ==========================================
  // NOT FOUND
  // ==========================================
  describe('Página 404 - Not Found', () => {
    it('deve mostrar NotFound para rota inexistente', async () => {
      setupAuthMock(AUTH_SCENARIOS.admin);
      const { container } = renderWithRouter('/rota-que-nao-existe-123');

      await waitFor(() => {
        expect(container.textContent).toMatch(/não encontrada|not found|404/i);
      });
    });

    it('deve mostrar NotFound para path muito aninhado inexistente', async () => {
      setupAuthMock(AUTH_SCENARIOS.admin);
      const { container } = renderWithRouter('/settings/inexistente/sub/path');

      await waitFor(() => {
        expect(container.textContent).toMatch(/não encontrada|not found|404/i);
      });
    });
  });

  // ==========================================
  // LOADING STATE
  // ==========================================
  describe('Loading State', () => {
    it('deve mostrar loader enquanto isLoading=true', async () => {
      setupAuthMock(AUTH_SCENARIOS.loading);
      const { container } = renderWithRouter('/dashboard');

      await waitFor(
        () => {
          const hasLoader = container.querySelector('[role="status"]') ||
                           container.querySelector('[data-testid="loading"]') ||
                           container.textContent?.match(/carregando|loading/i);
          expect(hasLoader).toBeTruthy();
        },
        { timeout: 1000 }
      );
    });
  });
});
