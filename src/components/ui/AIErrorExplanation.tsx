import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, Loader2, Lightbulb, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { explainError, ErrorExplanation, getQuickExplanation } from '@/services/aiErrorService';
import { cn } from '@/lib/utils';

interface AIErrorExplanationProps {
  error: string;
  context?: Record<string, any>;
  action?: string;
  onDismiss?: () => void;
  className?: string;
  useAI?: boolean;
}

const severityConfig = {
  info: {
    icon: Info,
    variant: 'default' as const,
    className: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100'
  },
  warning: {
    icon: AlertTriangle,
    variant: 'default' as const,
    className: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100'
  },
  error: {
    icon: AlertCircle,
    variant: 'destructive' as const,
    className: ''
  }
};

export function AIErrorExplanation({
  error,
  context,
  action,
  onDismiss,
  className,
  useAI = false
}: AIErrorExplanationProps) {
  const [explanation, setExplanation] = useState<ErrorExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // First try quick local explanation
    const quickExplanation = getQuickExplanation(error);
    if (quickExplanation) {
      setExplanation(quickExplanation);
      
      // If AI is requested, enhance with AI in background
      if (useAI) {
        loadAIExplanation();
      }
    } else if (useAI) {
      // No local match, need AI
      loadAIExplanation();
    } else {
      // No AI, no local match - show raw error
      setExplanation({
        title: 'Erro',
        explanation: error,
        suggestion: 'Tente novamente ou contate o suporte.',
        severity: 'error'
      });
    }
  }, [error, context, action, useAI]);

  async function loadAIExplanation() {
    setIsLoading(true);
    try {
      const result = await explainError(error, { ...context, useAI: true }, action);
      setExplanation(result);
    } catch {
      // Keep local explanation if AI fails
    } finally {
      setIsLoading(false);
    }
  }

  if (!explanation && !isLoading) return null;

  const config = severityConfig[explanation?.severity || 'error'];
  const Icon = config.icon;

  return (
    <Alert 
      variant={config.variant} 
      className={cn(config.className, 'relative', className)}
    >
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      
      <Icon className="h-4 w-4" />
      
      <AlertTitle className="flex items-center gap-2">
        {explanation?.title || 'Analisando erro...'}
        {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
      </AlertTitle>
      
      <AlertDescription className="mt-2 space-y-2">
        <p>{explanation?.explanation}</p>
        
        {explanation?.suggestion && (
          <div className="flex items-start gap-2 mt-3 p-2 rounded bg-background/50">
            <Lightbulb className="h-4 w-4 mt-0.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <span className="text-sm">{explanation.suggestion}</span>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
