import { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useReconcilePayable } from '@/features/payables/hooks/usePayables';
import { findMatchesForPayables, MATCH_TYPE_LABELS, getConfidenceColor } from '@/services/payablesReconciliation';
import { Payable, PayableMatchResult } from '@/types/payables';

interface BankRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'entrada' | 'saida';
}

interface PayableMatchingSuggestionsProps {
  pendingPayables: Payable[];
  importedRecords: BankRecord[];
  onDismiss?: () => void;
}

export function PayableMatchingSuggestions({
  pendingPayables,
  importedRecords,
  onDismiss,
}: PayableMatchingSuggestionsProps) {
  const [matches, setMatches] = useState<PayableMatchResult[]>([]);
  const [dismissedMatches, setDismissedMatches] = useState<Set<string>>(new Set());
  const reconcile = useReconcilePayable();

  useEffect(() => {
    if (pendingPayables.length > 0 && importedRecords.length > 0) {
      const foundMatches = findMatchesForPayables(pendingPayables, importedRecords);
      // Only show high-confidence matches
      const highConfidenceMatches = foundMatches.filter(m => m.confidence >= 70);
      setMatches(highConfidenceMatches);
    }
  }, [pendingPayables, importedRecords]);

  const visibleMatches = matches.filter(m => !dismissedMatches.has(`${m.payableId}-${m.transactionId}`));

  if (visibleMatches.length === 0) {
    return null;
  }

  const handleReconcile = (match: PayableMatchResult) => {
    if (!match.transactionId) return;
    
    reconcile.mutate({
      payableId: match.payableId,
      bankItemId: match.transactionId,
      paidAmount: match.payable.valor,
    }, {
      onSuccess: () => {
        setDismissedMatches(prev => new Set(prev).add(`${match.payableId}-${match.transactionId}`));
      }
    });
  };

  const handleDismiss = (match: PayableMatchResult) => {
    setDismissedMatches(prev => new Set(prev).add(`${match.payableId}-${match.transactionId}`));
  };

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Boletos Encontrados no Extrato
          </span>
          <Badge variant="secondary">{visibleMatches.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-3">
            {visibleMatches.slice(0, 5).map((match, idx) => (
              <div
                key={`${match.payableId}-${match.transactionId}-${idx}`}
                className="flex items-center justify-between p-3 bg-background border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{match.payable.beneficiario}</p>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {MATCH_TYPE_LABELS[match.matchType]}
                    </Badge>
                    <span className={`text-sm ${getConfidenceColor(match.confidence)}`}>
                      {match.confidence}%
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {match.payable.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <span>
                      Venc: {format(new Date(match.payable.vencimento), 'dd/MM', { locale: ptBR })}
                    </span>
                    {match.bankStatementDescription && (
                      <span className="truncate max-w-[200px]" title={match.bankStatementDescription}>
                        → {match.bankStatementDescription}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleReconcile(match)}
                    disabled={reconcile.isPending}
                  >
                    {reconcile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Vincular
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(match)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {visibleMatches.length > 5 && (
              <p className="text-center text-sm text-muted-foreground">
                +{visibleMatches.length - 5} outros matches encontrados.{' '}
                <Link to="/payables/reconciliation" className="text-primary underline">
                  Ver todos
                </Link>
              </p>
            )}
          </div>
        </ScrollArea>
        {onDismiss && (
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={onDismiss}>
            Ignorar sugestões
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
