import { supabase } from '@/integrations/supabase/client';

export interface ErrorExplanation {
  title: string;
  explanation: string;
  suggestion: string;
  severity: 'info' | 'warning' | 'error';
}

// Local fallback explanations for common errors (used when AI is unavailable)
const LOCAL_ERROR_MAP: Record<string, ErrorExplanation> = {
  'ano_check': {
    title: 'Ano fora do período permitido',
    explanation: 'O ano da competência deve estar entre 2020 e 2099.',
    suggestion: 'Verifique se selecionou a competência correta no topo da tela.',
    severity: 'error'
  },
  'mes_check': {
    title: 'Mês inválido',
    explanation: 'O mês da competência deve estar entre 1 e 12.',
    suggestion: 'Selecione um mês válido na competência.',
    severity: 'error'
  },
  'tipo_check': {
    title: 'Tipo de documento não suportado',
    explanation: 'Este tipo de documento não é reconhecido pelo sistema.',
    suggestion: 'Tipos aceitos: DAS, DARF, GPS, INSS, FGTS, ISS, NF.',
    severity: 'error'
  },
  'duplicate key': {
    title: 'Documento já existe',
    explanation: 'Um documento com estas características já foi cadastrado.',
    suggestion: 'Verifique se você já não fez este upload anteriormente.',
    severity: 'warning'
  },
  'row-level security': {
    title: 'Sem permissão',
    explanation: 'Você não tem permissão para realizar esta ação.',
    suggestion: 'Verifique se está na unidade correta ou contate o administrador.',
    severity: 'error'
  },
  'storage': {
    title: 'Erro no upload do arquivo',
    explanation: 'Não foi possível salvar o arquivo no sistema.',
    suggestion: 'Verifique se o arquivo é menor que 10MB e tente novamente.',
    severity: 'error'
  },
  'network': {
    title: 'Erro de conexão',
    explanation: 'Não foi possível conectar ao servidor.',
    suggestion: 'Verifique sua conexão com a internet e tente novamente.',
    severity: 'error'
  }
};

function findLocalExplanation(errorMessage: string): ErrorExplanation | null {
  const lowerError = errorMessage.toLowerCase();
  
  for (const [key, explanation] of Object.entries(LOCAL_ERROR_MAP)) {
    if (lowerError.includes(key.toLowerCase())) {
      return explanation;
    }
  }
  
  return null;
}

export async function explainError(
  errorMessage: string,
  context?: Record<string, any>,
  actionAttempted?: string
): Promise<ErrorExplanation> {
  // First try local explanation (faster)
  const localExplanation = findLocalExplanation(errorMessage);
  
  // For simple known errors, return local explanation immediately
  if (localExplanation && !context?.useAI) {
    return localExplanation;
  }
  
  // Try AI explanation for complex cases
  try {
    const { data, error } = await supabase.functions.invoke('explain-error', {
      body: {
        error_message: errorMessage,
        context,
        action_attempted: actionAttempted
      }
    });
    
    if (error) throw error;
    
    return {
      title: data.title || 'Erro',
      explanation: data.explanation || errorMessage,
      suggestion: data.suggestion || 'Tente novamente.',
      severity: data.severity || 'error'
    };
  } catch (aiError) {
    console.warn('AI explanation failed, using local fallback:', aiError);
    
    // Return local explanation if available, otherwise generic
    return localExplanation || {
      title: 'Erro no sistema',
      explanation: errorMessage,
      suggestion: 'Verifique os dados e tente novamente.',
      severity: 'error'
    };
  }
}

// Quick local-only explanation (no AI call)
export function getQuickExplanation(errorMessage: string): ErrorExplanation | null {
  return findLocalExplanation(errorMessage);
}
