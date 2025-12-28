import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateEnvelopeId, ZplClosingData } from '@/utils/zpl';
import { format } from 'date-fns';

/**
 * Resultado do cálculo de diferença entre valores esperado e contado
 */
export interface CashClosingCalculation {
  expectedCash: number;
  countedCash: number;
  difference: number;
  hasDifference: boolean;
  differenceFormatted: string;
  status: 'ok' | 'divergencia';
}

/**
 * Payload para criação/atualização de fechamento
 */
export interface ClosingPayload {
  date: string;
  unitId: string;
  unitCode: string;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  notes?: string;
  envelopeId: string;
  closedBy: string;
}

/**
 * Opções para inicializar o hook
 */
export interface UseCashClosingCoreOptions {
  unitId: string;
  unitCode: string;
  toleranceThreshold?: number; // default: 0.01
}

/**
 * Hook compartilhado para lógica comum de fechamento de caixa
 * 
 * Usado por:
 * - CashClosing.tsx
 * - CashClosingSimple.tsx
 * - CashClosingWithSelection.tsx
 * - EnvelopeCashClosing.tsx
 */
export function useCashClosingCore(options: UseCashClosingCoreOptions) {
  const { unitId, unitCode, toleranceThreshold = 0.01 } = options;

  /**
   * Calcula a diferença entre valor esperado e contado
   */
  const calculateDifference = useCallback((expected: number, counted: number): CashClosingCalculation => {
    const difference = counted - expected;
    const hasDifference = Math.abs(difference) > toleranceThreshold;
    
    const sign = difference >= 0 ? '+' : '';
    const differenceFormatted = `${sign}R$ ${Math.abs(difference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    
    return {
      expectedCash: expected,
      countedCash: counted,
      difference,
      hasDifference,
      differenceFormatted,
      status: hasDifference ? 'divergencia' : 'ok',
    };
  }, [toleranceThreshold]);

  /**
   * Gera envelope_id único baseado em contagem de fechamentos existentes
   */
  const generateEnvelopeIdForClosing = useCallback(async (date: string, tableName: 'cash_closings' | 'daily_cash_closings' = 'daily_cash_closings'): Promise<string> => {
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq('unit_id', unitId)
      .gte('date', date);
    
    const sequence = (count || 0) + 1;
    return generateEnvelopeId(unitCode, date, sequence);
  }, [unitId, unitCode]);

  /**
   * Gera payload de fechamento completo
   */
  const buildClosingPayload = useCallback((params: {
    date: string;
    expected: number;
    counted: number;
    notes?: string;
    envelopeId: string;
    closedBy: string;
  }): ClosingPayload => {
    const calc = calculateDifference(params.expected, params.counted);
    return {
      date: params.date,
      unitId,
      unitCode,
      expectedBalance: params.expected,
      actualBalance: params.counted,
      difference: calc.difference,
      notes: params.notes,
      envelopeId: params.envelopeId,
      closedBy: params.closedBy,
    };
  }, [unitId, unitCode, calculateDifference]);

  /**
   * Gera dados para etiqueta ZPL
   */
  const buildZplData = useCallback((params: {
    unitName: string;
    date: string;
    actualBalance: number;
    envelopeId: string;
    closedByName: string;
  }): ZplClosingData => ({
    unitName: params.unitName,
    unitCode,
    date: params.date,
    actualBalance: params.actualBalance,
    envelopeId: params.envelopeId,
    closedByName: params.closedByName,
  }), [unitCode]);

  /**
   * Parsea valor monetário de string para número
   */
  const parseMonetaryValue = useCallback((value: string): number => {
    const cleaned = value.replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }, []);

  /**
   * Formata valor monetário para exibição
   */
  const formatCurrency = useCallback((value: number): string => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }, []);

  /**
   * Verifica se valor é válido para fechamento
   */
  const isValidAmount = useCallback((value: string): boolean => {
    const num = parseMonetaryValue(value);
    return !isNaN(num) && num >= 0;
  }, [parseMonetaryValue]);

  /**
   * Gera data formatada para exibição
   */
  const formatDateForLabel = useCallback((date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'dd/MM/yyyy');
  }, []);

  return {
    // Cálculos
    calculateDifference,
    parseMonetaryValue,
    isValidAmount,
    
    // Geração de dados
    generateEnvelopeIdForClosing,
    buildClosingPayload,
    buildZplData,
    
    // Formatação
    formatCurrency,
    formatDateForLabel,
    
    // Configuração
    toleranceThreshold,
  };
}

/**
 * Hook simplificado para cálculo de diferença em tempo real
 */
export function useCashDifference(expected: number, counted: string, toleranceThreshold = 0.01) {
  return useMemo(() => {
    const countedNum = parseFloat(counted.replace(',', '.')) || 0;
    const difference = countedNum - expected;
    const hasDifference = Math.abs(difference) > toleranceThreshold;
    
    return {
      countedValue: countedNum,
      difference,
      hasDifference,
      status: hasDifference ? 'divergencia' as const : 'ok' as const,
    };
  }, [expected, counted, toleranceThreshold]);
}
