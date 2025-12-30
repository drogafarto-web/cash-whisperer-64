import { toast } from 'sonner';
import { explainError, getQuickExplanation } from '@/services/aiErrorService';

interface ErrorContext {
  action?: string;
  screen?: string;
  data?: Record<string, any>;
}

/**
 * Centralizado handler de erros com explicação por IA
 * Mostra toast imediato e busca explicação detalhada
 */
export async function handleError(error: unknown, context?: ErrorContext): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  console.error('[handleError]', errorMessage, context);
  
  // Primeiro tenta explicação local rápida (sem latência)
  const quickExplanation = getQuickExplanation(errorMessage);
  
  if (quickExplanation) {
    toast.error(quickExplanation.title, {
      description: quickExplanation.suggestion,
      duration: 8000,
    });
    return;
  }
  
  // Se não tem explicação local, mostra loading e busca via IA
  const toastId = toast.loading('Analisando erro...', {
    description: errorMessage.substring(0, 100),
  });
  
  try {
    const explanation = await explainError(errorMessage, { ...context, useAI: true }, context?.action);
    
    toast.dismiss(toastId);
    toast.error(explanation.title, {
      description: explanation.suggestion,
      duration: 10000,
    });
  } catch {
    toast.dismiss(toastId);
    toast.error('Erro no sistema', {
      description: errorMessage,
      duration: 6000,
    });
  }
}

/**
 * Versão síncrona para casos onde não queremos esperar IA
 * Usa apenas explicações locais
 */
export function handleErrorSync(error: unknown, context?: ErrorContext): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  console.error('[handleErrorSync]', errorMessage, context);
  
  const quickExplanation = getQuickExplanation(errorMessage);
  
  if (quickExplanation) {
    toast.error(quickExplanation.title, {
      description: quickExplanation.suggestion,
      duration: 8000,
    });
  } else {
    toast.error('Erro', {
      description: errorMessage,
      duration: 6000,
    });
  }
}

/**
 * Wrapper para try/catch que automaticamente trata erros
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    await handleError(error, context);
    return null;
  }
}
