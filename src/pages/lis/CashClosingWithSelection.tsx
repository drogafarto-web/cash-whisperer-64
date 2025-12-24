/**
 * Página de Fechamento de Caixa com Seleção de Códigos LIS
 * 
 * Fluxo MVP:
 * 1. Carrega itens LIS do fechamento do dia
 * 2. Recepcionista seleciona quais códigos foram pagos
 * 3. Sistema calcula expectedCash dinamicamente
 * 4. Recepcionista informa countedCash
 * 5. Comparação e validação
 * 6. Confirmação com geração de etiqueta única
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Printer,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { 
  useCashClosingSelection, 
  LisClosureItemForSelection 
} from '@/hooks/useCashClosingSelection';
import { CashClosingSelectionTable, CashComparisonCard } from '@/components/cash-closing';
import { 
  createOrUpdateDailyClosing, 
  fetchLisItemsWithComponents,
  markLabelEmitted,
  checkLabelEmitted,
} from '@/services/cashClosingService';
import { generateClosingZpl, downloadZplFile, ZplClosingData } from '@/utils/zpl';

type PageStep = 'loading' | 'no_lis' | 'selection' | 'comparison' | 'success';

interface LisClosureData {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  unit_id: string;
}

interface DailyClosingData {
  id: string;
  envelope_id: string;
  counted_cash: number;
  expected_cash: number;
  status: string;
  label_emitted_at: string | null;
}

export default function CashClosingWithSelectionPage() {
  const navigate = useNavigate();
  const { user, profile, unit: userUnit, isLoading: authLoading } = useAuth();
  
  // Estados principais
  const [step, setStep] = useState<PageStep>('loading');
  const [lisClosure, setLisClosure] = useState<LisClosureData | null>(null);
  const [lisItems, setLisItems] = useState<LisClosureItemForSelection[]>([]);
  const [existingClosing, setExistingClosing] = useState<DailyClosingData | null>(null);
  
  // Estados do formulário
  const [countedCash, setCountedCash] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados ZPL
  const [zplDialogOpen, setZplDialogOpen] = useState(false);
  const [lastZpl, setLastZpl] = useState<{ zpl: string; envelopeId: string } | null>(null);
  
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const todayFormatted = useMemo(() => 
    format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }), 
  []);

  // Hook de seleção
  const {
    selectedIds,
    selectionState,
    initialized,
    initializeSelection,
    toggleSelection,
    selectAll,
    deselectAll,
    canSelectItem,
    isItemLocked,
    isSelected,
  } = useCashClosingSelection(lisItems);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Carregar dados
  useEffect(() => {
    if (user && userUnit) {
      loadData();
    } else if (user && !userUnit && !authLoading) {
      setStep('no_lis');
    }
  }, [user, userUnit, authLoading]);

  // Inicializar seleção quando items carregam
  useEffect(() => {
    if (lisItems.length > 0 && !initialized) {
      initializeSelection();
    }
  }, [lisItems, initialized, initializeSelection]);

  const loadData = async () => {
    if (!userUnit) return;
    
    setStep('loading');
    try {
      // Buscar fechamento LIS do dia
      const { data: closures, error: closureError } = await supabase
        .from('lis_closures')
        .select('id, period_start, period_end, status, unit_id')
        .eq('unit_id', userUnit.id)
        .gte('period_end', today)
        .lte('period_start', today)
        .order('created_at', { ascending: false })
        .limit(1);

      if (closureError) throw closureError;

      if (!closures || closures.length === 0) {
        setStep('no_lis');
        return;
      }

      const closure = closures[0];
      setLisClosure(closure);

      // Buscar itens com componentes
      const items = await fetchLisItemsWithComponents(closure.id);
      setLisItems((items || []) as LisClosureItemForSelection[]);

      // Verificar fechamento existente
      const { data: existingData } = await supabase
        .from('daily_cash_closings')
        .select('id, envelope_id, counted_cash, expected_cash, status, label_emitted_at')
        .eq('unit_id', userUnit.id)
        .eq('date', today)
        .single();

      if (existingData) {
        setExistingClosing(existingData);
        if (existingData.status === 'FECHADO' || existingData.label_emitted_at) {
          setStep('success');
          return;
        }
        // Restaurar valor contado se existir
        if (existingData.counted_cash) {
          setCountedCash(existingData.counted_cash.toString());
        }
      }

      setStep('selection');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do fechamento');
      setStep('no_lis');
    }
  };

  const handleProceedToComparison = () => {
    if (selectionState.selectedCount === 0) {
      toast.error('Selecione pelo menos um código LIS para o fechamento');
      return;
    }
    setStep('comparison');
  };

  const handleBackToSelection = () => {
    setStep('selection');
  };

  const handleConfirm = async (withDifference: boolean) => {
    if (!user || !lisClosure || !userUnit) return;
    
    if (withDifference && !justification.trim()) {
      toast.error('Informe uma justificativa para a diferença');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOrUpdateDailyClosing({
        lisClosureId: lisClosure.id,
        unitId: userUnit.id,
        unitCode: userUnit.code || 'UNIT',
        date: today,
        expectedCash: selectionState.expectedCash,
        countedCash: parseFloat(countedCash.replace(',', '.')),
        lisItemIds: Array.from(selectedIds),
        userId: user.id,
        notes: justification || undefined,
        existingClosingId: existingClosing?.id,
      });

      // Gerar ZPL
      const zplData: ZplClosingData = {
        unitName: userUnit.name || 'Unidade',
        unitCode: userUnit.code || 'UNIT',
        date: format(new Date(), 'dd/MM/yyyy'),
        actualBalance: parseFloat(countedCash.replace(',', '.')),
        envelopeId: result.envelopeId,
        closedByName: profile?.name || 'Usuário',
      };

      const zplContent = generateClosingZpl(zplData);
      setLastZpl({ zpl: zplContent, envelopeId: result.envelopeId });
      setZplDialogOpen(true);

      toast.success(`Fechamento confirmado! ${result.itemsLinked} códigos vinculados.`);
      setStep('success');
    } catch (error: any) {
      console.error('Erro ao confirmar fechamento:', error);
      toast.error(error.message || 'Erro ao confirmar fechamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!existingClosing || !user) return;

    try {
      const isEmitted = await checkLabelEmitted(existingClosing.id);
      if (isEmitted) {
        toast.error('Etiqueta já foi emitida. Não é possível gerar segunda via.');
        return;
      }

      await markLabelEmitted(existingClosing.id, user.id);
      toast.success('Etiqueta marcada como impressa');
      
      // Reload data
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao marcar etiqueta');
    }
  };

  const handleDownloadZpl = () => {
    if (lastZpl) {
      downloadZplFile(lastZpl.zpl, `etiqueta-${lastZpl.envelopeId}.zpl`);
    }
  };

  // Loading state
  if (authLoading || step === 'loading') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando fechamento do dia...</p>
        </div>
      </AppLayout>
    );
  }

  // No LIS data
  if (step === 'no_lis') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <Card className="max-w-lg w-full">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Movimento LIS não encontrado
                </h2>
                <p className="text-muted-foreground">
                  Ainda não existe movimento do LIS importado para hoje
                  {userUnit ? ` na unidade ${userUnit.name}` : ''}.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  <strong>O que fazer?</strong><br />
                  Acesse "Fechamento LIS" para importar o relatório do movimento diário.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Voltar ao Dashboard
                </Button>
                <Button onClick={() => navigate('/lis/fechamento')}>
                  Ir para Fechamento LIS
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <Card className="max-w-lg w-full">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Caixa fechado com sucesso!
                </h2>
                <p className="text-muted-foreground">
                  O fechamento de caixa de hoje foi registrado.
                </p>
                {existingClosing?.envelope_id && (
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
                    Envelope: {existingClosing.envelope_id}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={() => setZplDialogOpen(true)}>
                  <Printer className="w-4 h-4 mr-2" />
                  Ver/Imprimir Etiqueta
                </Button>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Voltar ao Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ZPL Dialog */}
        <Dialog open={zplDialogOpen} onOpenChange={setZplDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Etiqueta do Envelope</DialogTitle>
              <DialogDescription>
                {existingClosing?.label_emitted_at ? (
                  <span className="text-warning">
                    ⚠️ Etiqueta já foi emitida anteriormente. Abaixo está uma cópia.
                  </span>
                ) : (
                  'Copie o código ZPL ou faça download para imprimir.'
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {lastZpl && (
                <>
                  <Textarea 
                    value={lastZpl.zpl} 
                    readOnly 
                    className="font-mono text-xs h-64"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={handleDownloadZpl}>
                      Download .zpl
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(lastZpl.zpl);
                        toast.success('Código ZPL copiado!');
                      }}
                    >
                      Copiar
                    </Button>
                    {!existingClosing?.label_emitted_at && (
                      <Button variant="secondary" onClick={handlePrintLabel}>
                        Marcar como Impressa
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </AppLayout>
    );
  }

  // Selection step
  if (step === 'selection') {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Fechamento de Caixa
            </h1>
            <p className="text-muted-foreground capitalize">{todayFormatted}</p>
            {userUnit && (
              <p className="text-sm text-muted-foreground">
                Unidade: <span className="font-medium text-foreground">{userUnit.name}</span>
              </p>
            )}
          </div>

          {/* Instrução */}
          <Alert>
            <Package className="h-4 w-4" />
            <AlertTitle>Selecione os códigos LIS pagos neste fechamento</AlertTitle>
            <AlertDescription>
              Marque apenas os códigos que foram efetivamente pagos em dinheiro, pix ou cartão 
              e que vão para o envelope de hoje.
            </AlertDescription>
          </Alert>

          {/* Tabela de seleção */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Códigos LIS do Dia</CardTitle>
              <CardDescription>
                Selecione os códigos que foram pagos neste fechamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CashClosingSelectionTable
                items={lisItems}
                selectedIds={selectedIds}
                onToggleSelection={toggleSelection}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                canSelectItem={canSelectItem}
                isItemLocked={isItemLocked}
              />
            </CardContent>
          </Card>

          {/* Resumo e botão de prosseguir */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor esperado no envelope:</p>
                  <p className="text-3xl font-bold text-primary">
                    R$ {selectionState.expectedCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectionState.selectedCount} código(s) selecionado(s)
                  </p>
                </div>
                <Button 
                  size="lg" 
                  onClick={handleProceedToComparison}
                  disabled={selectionState.selectedCount === 0}
                >
                  Conferir Caixa
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Comparison step
  return (
    <AppLayout>
      <div className="space-y-6 max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Conferência de Caixa
          </h1>
          <p className="text-muted-foreground capitalize">{todayFormatted}</p>
          {userUnit && (
            <p className="text-sm text-muted-foreground">
              Unidade: <span className="font-medium text-foreground">{userUnit.name}</span>
            </p>
          )}
        </div>

        {/* Botão voltar */}
        <Button variant="ghost" onClick={handleBackToSelection}>
          ← Voltar para seleção
        </Button>

        {/* Card de comparação */}
        <CashComparisonCard
          expectedCash={selectionState.expectedCash}
          countedCash={countedCash}
          onCountedCashChange={setCountedCash}
          justification={justification}
          onJustificationChange={setJustification}
          selectedCount={selectionState.selectedCount}
          onConfirm={handleConfirm}
          onReset={() => setCountedCash('')}
          isSubmitting={isSubmitting}
        />
      </div>

      {/* ZPL Dialog */}
      <Dialog open={zplDialogOpen} onOpenChange={setZplDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Etiqueta do Envelope Gerada</DialogTitle>
            <DialogDescription>
              Copie o código ZPL abaixo ou faça download para imprimir
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {lastZpl && (
              <>
                <div className="bg-success/10 border border-success/30 rounded p-3 text-center">
                  <p className="font-mono font-bold text-lg">{lastZpl.envelopeId}</p>
                  <p className="text-sm text-muted-foreground">ID do Envelope</p>
                </div>
                <Textarea 
                  value={lastZpl.zpl} 
                  readOnly 
                  className="font-mono text-xs h-48"
                />
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleDownloadZpl}>
                    Download .zpl
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      navigator.clipboard.writeText(lastZpl.zpl);
                      toast.success('Código ZPL copiado!');
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
