import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GitMerge, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UnitSelector } from '@/components/UnitSelector';
import { Skeleton } from '@/components/ui/skeleton';

import { usePendingPayablesForReconciliation, useReconcilePayable } from '@/features/payables';
import { useUnreconciledTransactions } from '@/features/payables/hooks/usePayablesDashboard';
import { useAuth } from '@/hooks/useAuth';
import {
  findMatchesForPayables,
  MATCH_TYPE_LABELS,
  getConfidenceColor,
} from '@/services/payablesReconciliation';
import { PayableMatchResult } from '@/types/payables';

export default function ReconciliationPage() {
  const { isAdmin, unit: userUnit } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string>(userUnit?.id || '');

  const effectiveUnitId = isAdmin ? selectedUnitId || undefined : userUnit?.id;

  const { data: pendingPayables = [], isLoading: isLoadingPayables, refetch: refetchPayables } = usePendingPayablesForReconciliation(effectiveUnitId);
  const { data: bankRecords = [], isLoading: isLoadingTransactions, refetch: refetchTransactions } = useUnreconciledTransactions(effectiveUnitId);
  const reconcile = useReconcilePayable();

  const isLoading = isLoadingPayables || isLoadingTransactions;

  const matches = findMatchesForPayables(pendingPayables, bankRecords);

  const handleReconcile = (match: PayableMatchResult) => {
    if (!match.transactionId) return;
    
    reconcile.mutate({
      payableId: match.payableId,
      bankItemId: match.transactionId,
      paidAmount: match.payable.valor,
    });
  };

  const handleRefresh = () => {
    refetchPayables();
    refetchTransactions();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitMerge className="h-6 w-6" />
              Conciliação de Boletos
            </h1>
            <p className="text-muted-foreground">
              Vincule boletos pendentes com movimentações do extrato bancário
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="w-48">
                <UnitSelector
                  value={selectedUnitId}
                  onChange={setSelectedUnitId}
                  placeholder="Todas"
                />
              </div>
            )}
            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Boletos Pendentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Boletos Pendentes</span>
                <Badge variant="secondary">{pendingPayables.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                ) : pendingPayables.length === 0 ? (
                  <div className="text-center py-8">
                    <Check className="h-12 w-12 mx-auto text-green-500 mb-2" />
                    <p className="text-muted-foreground">Todos os boletos estão conciliados!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingPayables.map((payable) => {
                      const payableMatches = matches.filter((m) => m.payableId === payable.id);
                      const hasSuggestion = payableMatches.length > 0;

                      return (
                        <div
                          key={payable.id}
                          className={`p-4 border rounded-lg ${hasSuggestion ? 'border-primary/50 bg-primary/5' : ''}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium">{payable.beneficiario}</p>
                              <p className="text-sm text-muted-foreground">
                                Venc: {format(new Date(payable.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            </div>
                            <p className="font-bold">
                              {payable.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>

                          {payable.linha_digitavel && (
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {payable.linha_digitavel}
                            </p>
                          )}

                          {hasSuggestion && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm font-medium mb-2">Sugestões:</p>
                              {payableMatches.slice(0, 2).map((match, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-sm p-2 bg-background rounded"
                                >
                                  <div>
                                    <Badge variant="outline" className="text-xs">
                                      {MATCH_TYPE_LABELS[match.matchType]}
                                    </Badge>
                                    <span className={`ml-2 ${getConfidenceColor(match.confidence)}`}>
                                      {match.confidence}%
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReconcile(match)}
                                    disabled={reconcile.isPending}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Vincular
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Extrato Bancário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Transações de Saída</span>
                <Badge variant="secondary">{bankRecords.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {isLoadingTransactions ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    ))}
                  </div>
                ) : bankRecords.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhuma transação de saída encontrada</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Importe um extrato bancário ou verifique o filtro de unidade
                    </p>
                    <Button variant="outline" className="mt-4" asChild>
                      <Link to="/import/bank-statement">Importar Extrato</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bankRecords.map((record) => (
                        <div key={record.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between">
                            <p className="font-medium truncate">{record.description}</p>
                            <p className="font-bold text-destructive">
                              {Math.abs(record.amount).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(record.date), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
