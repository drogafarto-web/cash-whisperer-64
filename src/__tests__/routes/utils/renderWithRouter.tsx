import React, { Suspense } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { waitFor } from '@/test/utils';

// Import real routes
import {
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
} from '@/routes';

// Re-export waitFor for convenience
export { waitFor };

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

// All routes composed (same order as main router)
const allRoutes = [
  ...dashboardRoutes,
  ...operationsRoutes,
  ...payablesRoutes,
  ...billingRoutes,
  ...accountingRoutes,
  ...reportsRoutes,
  ...settingsRoutes,
  ...importRoutes,
  ...kioskRoutes,
  ...publicRoutes, // public routes last (includes catch-all)
];

interface RenderWithRouterOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
}

export function renderWithRouter(
  initialRoute: string = '/',
  options?: RenderWithRouterOptions
) {
  const testQueryClient = createTestQueryClient();

  const router = createMemoryRouter(allRoutes, {
    initialEntries: [initialRoute],
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>
      <TooltipProvider>
        <Suspense fallback={<div data-testid="loading-suspense">Loading...</div>}>
          {children}
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );

  const result = render(<RouterProvider router={router} />, { wrapper: Wrapper, ...options });

  return {
    ...result,
    router,
    // Helper methods that work with the container
    queryByText: (text: string | RegExp) => result.container.querySelector(`*`)?.textContent?.match(text) ? result.container : null,
    getByText: (text: string | RegExp) => {
      const elements = result.container.querySelectorAll('*');
      for (const el of elements) {
        if (el.textContent?.match(text)) {
          return el;
        }
      }
      throw new Error(`Unable to find element with text: ${text}`);
    },
    findByText: async (text: string | RegExp, options?: { timeout?: number }) => {
      await waitFor(() => {
        const elements = result.container.querySelectorAll('*');
        for (const el of elements) {
          if (el.textContent?.match(text)) {
            return;
          }
        }
        throw new Error(`Unable to find element with text: ${text}`);
      }, options);
      return result.getByText(text as string);
    },
  };
}

// Helper to wait for navigation to complete
export async function waitForNavigation(
  router: ReturnType<typeof createMemoryRouter>,
  expectedPath: string,
  timeout = 3000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (router.state.location.pathname === expectedPath) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    `Navigation timeout: expected ${expectedPath}, got ${router.state.location.pathname}`
  );
}
