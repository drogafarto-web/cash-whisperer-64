import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';
import { router } from '@/routes';

// QueryClient fora do componente para persistência entre re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
});

// Loading fallback para Suspense durante lazy loading
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * App - Componente raiz da aplicação
 * 
 * Estrutura refatorada:
 * - Lazy loading para todas as páginas (code splitting)
 * - Rotas modulares em src/routes/
 * - Proteção por roles e functions via ProtectedRoute
 * - URLs padronizadas em inglês
 */
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Suspense fallback={<PageLoader />}>
            <RouterProvider router={router} />
          </Suspense>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
