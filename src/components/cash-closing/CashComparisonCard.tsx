/**
 * Card de comparação entre valor esperado e valor contado
 * 
 * Mostra visualmente se o caixa bateu ou se há diferença.
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle,
  AlertTriangle,
  Calculator,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface CashComparisonCardProps {
  expectedCash: number;
  countedCash: string;
  onCountedCashChange: (value: string) => void;
  justification: string;
  onJustificationChange: (value: string) => void;
  selectedCount: number;
  onConfirm: (withDifference: boolean) => void;
  onReset: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
}

export function CashComparisonCard({
  expectedCash,
  countedCash,
  onCountedCashChange,
  justification,
  onJustificationChange,
  selectedCount,
  onConfirm,
  onReset,
  isSubmitting,
  disabled = false,
}: CashComparisonCardProps) {
  const countedValue = useMemo(() => {
    return parseFloat(countedCash.replace(',', '.')) || 0;
  }, [countedCash]);

  const difference = useMemo(() => {
    return countedValue - expectedCash;
  }, [countedValue, expectedCash]);

  const hasDifference = Math.abs(difference) > 0.01;
  const hasValidCounted = countedCash.length > 0 && !isNaN(countedValue);

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-6 space-y-6">
        {/* Resumo da seleção */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calculator className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Dinheiro Esperado ({selectedCount} códigos)
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground">
            R$ {expectedCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Input de valor contado */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-lg font-medium text-foreground">
            <Calculator className="w-5 h-5 text-muted-foreground" />
            Quanto você contou no caixa?
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
              R$
            </span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={countedCash}
              onChange={e => onCountedCashChange(e.target.value)}
              className="text-3xl h-16 pl-12 text-center font-bold"
              disabled={disabled}
              autoFocus
            />
          </div>
        </div>

        {/* Resultado da comparação */}
        {hasValidCounted && (
          <div className="space-y-4">
            {/* Comparação */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Esperado</p>
                <p className="text-lg font-bold">
                  R$ {expectedCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Contado</p>
                <p className="text-lg font-bold">
                  R$ {countedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Mensagem de resultado */}
            {!hasDifference ? (
              <Alert className="bg-success/10 border-success/30">
                <CheckCircle className="w-5 h-5 text-success" />
                <AlertTitle className="text-success">Tudo certo, o caixa bateu!</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Diferença: R$ 0,00
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-warning/10 border-warning/30">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <AlertTitle className="text-warning">Atenção: O caixa não bateu!</AlertTitle>
                <AlertDescription>
                  <span className={`text-xl font-bold ${difference >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {difference >= 0 ? 'Sobrando' : 'Faltando'}: R$ {Math.abs(difference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Reconte o caixa antes de confirmar.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Ações */}
            {!hasDifference ? (
              <Button
                onClick={() => onConfirm(false)}
                className="w-full h-14 text-lg bg-success hover:bg-success/90"
                disabled={isSubmitting || disabled}
              >
                {isSubmitting && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                <CheckCircle className="w-5 h-5 mr-2" />
                Confirmar Fechamento
              </Button>
            ) : (
              <div className="space-y-4">
                <Button
                  variant="outline"
                  onClick={onReset}
                  className="w-full h-12"
                  disabled={isSubmitting}
                >
                  Digitar outro valor
                </Button>

                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    Se tiver certeza que está correto:
                  </p>
                  <Textarea
                    placeholder="Justificativa obrigatória para diferença..."
                    value={justification}
                    onChange={e => onJustificationChange(e.target.value)}
                    rows={2}
                    disabled={disabled}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => onConfirm(true)}
                    className="w-full h-12"
                    disabled={isSubmitting || !justification.trim() || disabled}
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Confirmar com diferença
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
