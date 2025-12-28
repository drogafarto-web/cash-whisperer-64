import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Package, Banknote, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface EnvelopeConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  selectedCount: number;
  expectedCash: number;
  countedCash: number;
  justificativa?: string;
  isSubmitting?: boolean;
}

export function EnvelopeConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  selectedCount,
  expectedCash,
  countedCash,
  justificativa,
  isSubmitting,
}: EnvelopeConfirmModalProps) {
  const difference = Math.abs(countedCash - expectedCash);
  const hasDifference = difference > 0.01;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Confirmar Criação do Envelope
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p className="text-muted-foreground">
                Verifique os dados antes de criar o envelope. Esta ação não pode ser desfeita.
              </p>

              {/* Resumo */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Códigos LIS</span>
                  <Badge variant="secondary">{selectedCount} códigos</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor Esperado</span>
                  <span className="font-medium text-foreground">{formatCurrency(expectedCash)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor Contado</span>
                  <span className="font-medium text-foreground flex items-center gap-1">
                    <Banknote className="h-4 w-4 text-primary" />
                    {formatCurrency(countedCash)}
                  </span>
                </div>

                {hasDifference && (
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm text-muted-foreground">Diferença</span>
                    <span className={`font-medium ${difference > 5 ? 'text-destructive' : 'text-amber-600'}`}>
                      {countedCash > expectedCash ? '+' : '-'}{formatCurrency(difference)}
                    </span>
                  </div>
                )}
              </div>

              {/* Justificativa */}
              {justificativa && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Justificativa da diferença:
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {justificativa}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Criando...' : 'Criar Envelope'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
