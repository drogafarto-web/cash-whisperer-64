import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.logErrorToBackend(error, errorInfo);
  }

  private async logErrorToBackend(error: Error, errorInfo: ErrorInfo) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const errorId = crypto.randomUUID().slice(0, 8).toUpperCase();

      await supabase.from('app_error_logs').insert({
        error_message: error.message,
        error_stack: error.stack,
        route: window.location.pathname,
        user_id: userData?.user?.id || null,
        user_agent: navigator.userAgent,
        metadata: {
          errorId,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
        },
      });

      this.setState({ errorId });
    } catch (logError) {
      console.error('Failed to log error to backend:', logError);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoBack = () => {
    window.history.back();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Algo deu errado
                </h2>
                <p className="text-muted-foreground text-sm">
                  Ocorreu um erro inesperado. Por favor, tente novamente.
                </p>
                {this.state.errorId && (
                  <p className="text-xs text-muted-foreground">
                    Código do erro: <code className="bg-muted px-1 py-0.5 rounded">{this.state.errorId}</code>
                  </p>
                )}
                {import.meta.env.DEV && this.state.error && (
                  <p className="text-xs text-destructive mt-2 font-mono bg-destructive/5 p-2 rounded">
                    {this.state.error.message}
                  </p>
                )}
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={this.handleGoBack}>
                  Voltar
                </Button>
                <Button onClick={this.handleReload} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Recarregar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
