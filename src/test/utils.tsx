import React, { ReactElement } from 'react';
import { render, RenderOptions, renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface WrapperProps {
  children: React.ReactNode;
}

function createWrapper() {
  const testQueryClient = createTestQueryClient();
  return function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={testQueryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: createWrapper(), ...options });

// Custom waitFor implementation
const waitFor = async (callback: () => void | Promise<void>, options?: { timeout?: number }) => {
  const timeout = options?.timeout || 1000;
  const interval = 50;
  const maxAttempts = timeout / interval;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await callback();
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  await callback(); // Final attempt, will throw if fails
};

export { render, renderHook, act } from '@testing-library/react';
export { customRender, createTestQueryClient, createWrapper, waitFor };
