// Tipos para sistema de detecção de duplicidade multi-nível

export type DuplicateLevel = 'blocked' | 'high' | 'medium' | 'low' | 'none';

export interface ExistingPayableData {
  id: string;
  beneficiario: string;
  valor: number;
  vencimento: string;
  status: string;
  document_number?: string | null;
}

export interface DuplicateCheckResult {
  level: DuplicateLevel;
  reason?: string;
  existingId?: string;
  existingData?: ExistingPayableData;
}

export const DUPLICATE_LEVEL_CONFIG: Record<DuplicateLevel, {
  color: 'destructive' | 'warning' | 'info' | 'default';
  title: string;
  allowContinue: boolean;
  description: string;
}> = {
  blocked: {
    color: 'destructive',
    title: 'Documento Duplicado',
    allowContinue: false,
    description: 'Este documento já está cadastrado no sistema e não pode ser registrado novamente.',
  },
  high: {
    color: 'warning',
    title: 'Alta Probabilidade de Duplicidade',
    allowContinue: true,
    description: 'Encontramos um registro muito similar. Confirme se deseja cadastrar mesmo assim.',
  },
  medium: {
    color: 'warning',
    title: 'Possível Duplicidade',
    allowContinue: true,
    description: 'Existe um registro com dados semelhantes. Verifique antes de continuar.',
  },
  low: {
    color: 'info',
    title: 'Registro Similar Encontrado',
    allowContinue: true,
    description: 'Encontramos um registro parecido, mas pode ser apenas coincidência.',
  },
  none: {
    color: 'default',
    title: '',
    allowContinue: true,
    description: '',
  },
};
