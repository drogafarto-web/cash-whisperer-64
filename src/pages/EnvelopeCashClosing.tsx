/**
 * Página de Fechamento de Caixa por Envelope
 * 
 * REGRA DE NEGÓCIO PRINCIPAL:
 * - O fechamento NÃO é por dia, mas por envelope
 * - Cada código LIS pode estar em no máximo um envelope
 * - Códigos LIS ficam disponíveis até serem vinculados a um envelope (envelope_id IS NULL)
 * - Não há filtro por data - códigos de dias anteriores continuam visíveis
 * 
 * CONTROLE DE ACESSO:
 * - Requer função operacional: 'caixa' ou 'supervisao'
 * - Admin tem acesso total
 * 
 * Fluxo:
 * 1. Buscar códigos LIS onde: unit_id = X AND cash_component > 0 AND envelope_id IS NULL
 * 2. Recepcionista seleciona quais códigos foram pagos
 * 3. Digita o valor contado
 * 4. Confirma e gera etiqueta única
 * 5. Códigos selecionados recebem envelope_id e somem da lista
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireFunction } from '@/components/auth/RequireFunction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Package,
  Mail,
  FileUp,
} from 'lucide-react';
import { useEnvelopeSelection } from '@/hooks/useEnvelopeSelection';
import {
  EnvelopeItemsTable,
  EnvelopeSummaryCard,
  EnvelopeComparisonCard,
  EnvelopeLabelPreview,
  EnvelopeStepsIndicator,
  EnvelopeConfirmModal,
} from '@/components/envelope';
import { NoActiveUnitMessage } from '@/components/layout/NoActiveUnitMessage';
import {
  getAvailableItemsForEnvelope,
  createEnvelopeWithItems,
  checkLabelPrinted,
  markLabelPrinted,
  incrementReprintCount,
  LisItemForEnvelope,
  EnvelopeData,
} from '@/services/envelopeClosingService';
import { logEnvelopeCreated, logEnvelopePrinted } from '@/services/cashAuditService';
import { generateEnvelopeZpl, downloadZplFile } from '@/utils/zpl';

type PageStep = 'loading' | 'no_items' | 'selection' | 'comparison' | 'success';

function EnvelopeCashClosingContent() {
  const navigate = useNavigate();
  const { user, profile, activeUnit, isLoading: authLoading } = useAuth();
  
  // Estados principais
  const [step, setStep] = useState<PageStep>('loading');
  const [availableItems, setAvailableItems] = useState<LisItemForEnvelope[]>([]);
  const [createdEnvelope, setCreatedEnvelope] = useState<EnvelopeData | null>(null);
  
  // Estados do formulário
  const [countedCash, setCountedCash] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [labelAlreadyPrinted, setLabelAlreadyPrinted] = useState(false);
  const [reprintCount, setReprintCount] = useState(0);
  
  const todayFormatted = useMemo(() => 
    format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }), 
  []);

  // Hook de seleção
  const {
    selectedIds,
    expectedCash,
    selectedCount,
    selectableCount,
    allSelected,
    toggleItem,
    selectAll,
    clearSelection,
    getSelectedIds,
  } = useEnvelopeSelection(availableItems);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Carregar dados quando tiver unidade
  useEffect(() => {
    if (user && activeUnit && !authLoading) {
      loadData();
    } else if (user && !activeUnit && !authLoading) {
      setStep('no_items');
    }
  }, [user, activeUnit, authLoading]);

  /**
   * Carrega itens LIS disponíveis para envelope
   * Query: unit_id = X AND cash_component > 0 AND envelope_id IS NULL
   */
  const loadData = async () => {
    if (!activeUnit) return;
    
    setStep('loading');
    try {
      const items = await getAvailableItemsForEnvelope(activeUnit.id);
      setAvailableItems(items);

      if (items.length === 0) {
        setStep('no_items');
      } else {
        setStep('selection');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar códigos LIS disponíveis');
      setStep('no_items');
    }
  };

  const handleProceedToComparison = () => {
    if (selectedCount === 0) {
      toast.error('Selecione pelo menos um código LIS para o envelope');
      return;
    }
    setStep('comparison');
  };

  const handleBackToSelection = () => {
    setStep('selection');
  };

  const handleOpenConfirmModal = () => {
    const countedValue = parseFloat(countedCash.replace(',', '.')) || 0;
    const difference = Math.abs(countedValue - expectedCash);
    
    // Se diferença > 5, exigir justificativa
    if (difference > 5 && !justificativa.trim()) {
      toast.error('Informe uma justificativa para a diferença de valores');
      return;
    }
    
    setShowConfirmModal(true);
  };

  const handleConfirmEnvelope = async () => {
    if (!user || !activeUnit) return;
    
    const countedValue = parseFloat(countedCash.replace(',', '.')) || 0;

    setShowConfirmModal(false);
    try {
      const selectedItemIds = getSelectedIds();
      const envelope = await createEnvelopeWithItems({
        unitId: activeUnit.id,
        selectedItemIds,
        countedCash: countedValue,
        justificativa: justificativa.trim() || undefined,
        userId: user.id,
      });

      // Log audit action
      await logEnvelopeCreated({
        userId: user.id,
        unitId: activeUnit.id,
        envelopeId: envelope.id,
        itemCount: envelope.lis_codes_count,
        amount: expectedCash,
        lisCodes: envelope.lis_codes,
      });

      setCreatedEnvelope(envelope);
      toast.success(`Envelope criado com ${envelope.lis_codes_count} códigos LIS!`);
      setStep('success');
    } catch (error: unknown) {
      console.error('Erro ao criar envelope:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar envelope';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!createdEnvelope || !user || !activeUnit) return;
    setIsSubmitting(true);
    try {
      const printed = await checkLabelPrinted(createdEnvelope.id);
      setLabelAlreadyPrinted(printed);
      
      if (!printed) {
        await markLabelPrinted(createdEnvelope.id, user.id);
        await logEnvelopePrinted({
          userId: user.id,
          unitId: activeUnit.id,
          envelopeId: createdEnvelope.id,
          reprintCount: 0,
        });
        toast.success('Etiqueta marcada como impressa');
      } else {
        const copyNumber = await incrementReprintCount(createdEnvelope.id);
        setReprintCount(copyNumber);
        await logEnvelopePrinted({
          userId: user.id,
          unitId: activeUnit.id,
          envelopeId: createdEnvelope.id,
          reprintCount: copyNumber,
        });
        toast.info(`Reimprimindo - CÓPIA ${copyNumber}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar etiqueta';
      toast.error(errorMessage);
    }
  };

  const handleDownloadZpl = () => {
    if (!createdEnvelope || !activeUnit) return;

    const zplData = {
      unitName: activeUnit.name || 'Unidade',
      unitCode: activeUnit.code || 'UNIT',
      periodStart: format(new Date(), 'dd/MM/yyyy'),
      periodEnd: format(new Date(), 'dd/MM/yyyy'),
      cashTotal: createdEnvelope.counted_cash || createdEnvelope.expected_cash,
      lisCodes: createdEnvelope.lis_codes,
      closedByName: profile?.name || 'Usuário',
      closureId: createdEnvelope.id,
      copyNumber: reprintCount > 0 ? reprintCount : undefined,
    };

    const zplContent = generateEnvelopeZpl(zplData);
    downloadZplFile(zplContent, `envelope-${createdEnvelope.id.substring(0, 8)}${reprintCount > 0 ? `-copia${reprintCount}` : ''}.zpl`);
  };

  const handleNewEnvelope = () => {
    setCreatedEnvelope(null);
    setCountedCash('');
    setJustificativa('');
    setLabelAlreadyPrinted(false);
    setReprintCount(0);
    clearSelection();
    loadData();
  };

  // Loading state
  if (authLoading || step === 'loading') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </AppLayout>
    );
  }

  // No items available (includes case of no unit)
  if (step === 'no_items') {
    // Check if it's because user has no unit
    if (!activeUnit) {
      return (
        <AppLayout>
          <NoActiveUnitMessage />
        </AppLayout>
      );
    }

    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <Card className="max-w-lg w-full">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Nenhum código disponível para envelope
                </h2>
                <p className="text-muted-foreground">
                  Não há códigos LIS com pagamento em dinheiro pendente
                  {activeUnit ? ` na unidade ${activeUnit.name}` : ''}.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  <strong>O que fazer?</strong><br />
                  1. Importe o movimento do LIS em "Importar Movimento"<br />
                  2. Códigos com pagamento em dinheiro aparecerão aqui automaticamente
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Voltar ao Dashboard
                </Button>
                <Button onClick={() => navigate('/import/daily-movement')}>
                  <FileUp className="h-4 w-4 mr-2" />
                  Importar Movimento
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Success state
  if (step === 'success' && createdEnvelope) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <Card className="max-w-xl w-full">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Envelope Criado com Sucesso!</CardTitle>
              <CardDescription>
                O envelope foi fechado e os códigos LIS foram vinculados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <EnvelopeLabelPreview
                envelopeId={createdEnvelope.id}
                unitName={activeUnit?.name || 'Unidade'}
                unitCode={activeUnit?.code || 'UNIT'}
                countedCash={createdEnvelope.counted_cash || createdEnvelope.expected_cash}
                lisCodesCount={createdEnvelope.lis_codes_count}
                closedByName={profile?.name || 'Usuário'}
                createdAt={createdEnvelope.created_at}
                lisCodes={createdEnvelope.lis_codes}
                labelAlreadyPrinted={labelAlreadyPrinted}
                reprintCount={reprintCount}
                onPrintLabel={handlePrintLabel}
                onDownloadZpl={handleDownloadZpl}
              />

              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => navigate('/dashboard')}
                >
                  Voltar ao Dashboard
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleNewEnvelope}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Criar Novo Envelope
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Selection step
  if (step === 'selection') {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-6xl mx-auto">
          {/* Steps Indicator */}
          <EnvelopeStepsIndicator currentStep="selection" />

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Fechamento de Caixa por Envelope
            </h1>
            <p className="text-muted-foreground capitalize"><span className="font-medium">Hoje:</span> {todayFormatted}</p>
            {activeUnit && (
              <p className="text-sm text-muted-foreground">
                Unidade: <span className="font-medium text-foreground">{activeUnit.name}</span>
              </p>
            )}
          </div>

          {/* Instrução */}
          <Alert>
            <Package className="h-4 w-4" />
            <AlertTitle>Selecione os códigos para este envelope</AlertTitle>
            <AlertDescription>
              Marque os códigos LIS que foram pagos e vão entrar neste envelope de dinheiro.
              Cada código só pode estar em um envelope. Códigos permanecem disponíveis até serem fechados.
            </AlertDescription>
          </Alert>

          {/* Tabela de seleção */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Códigos LIS Disponíveis</CardTitle>
              <CardDescription>
                {selectableCount} código(s) em dinheiro selecionáveis • {availableItems.length - selectableCount} outros pagamentos (apenas visualização)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnvelopeItemsTable
                items={availableItems}
                selectedIds={selectedIds}
                onToggleItem={toggleItem}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                allSelected={allSelected}
              />
            </CardContent>
          </Card>

          {/* Resumo dinâmico */}
          <EnvelopeSummaryCard
            expectedCash={expectedCash}
            selectedCount={selectedCount}
            totalAvailable={availableItems.length}
          />

          {/* Botão de prosseguir */}
          <div className="flex justify-end">
            <Button 
              size="lg" 
              onClick={handleProceedToComparison}
              disabled={selectedCount === 0}
            >
              Contar Dinheiro
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Comparison step
  return (
    <AppLayout>
      <div className="space-y-6 max-w-lg mx-auto">
        {/* Steps Indicator */}
        <EnvelopeStepsIndicator currentStep="comparison" />

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Conferência do Envelope
          </h1>
          <p className="text-muted-foreground capitalize"><span className="font-medium">Hoje:</span> {todayFormatted}</p>
          {activeUnit && (
            <p className="text-sm text-muted-foreground">
              Unidade: <span className="font-medium text-foreground">{activeUnit.name}</span>
            </p>
          )}
        </div>

        {/* Card de comparação */}
        <EnvelopeComparisonCard
          expectedCash={expectedCash}
          countedCash={countedCash}
          onCountedCashChange={setCountedCash}
          justificativa={justificativa}
          onJustificativaChange={setJustificativa}
          selectedCount={selectedCount}
        />

        {/* Botões de ação */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleBackToSelection}
            disabled={isSubmitting}
            className="flex-1"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button 
            onClick={handleOpenConfirmModal}
            disabled={isSubmitting || !countedCash}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Envelope
              </>
            )}
          </Button>
        </div>

        {/* Modal de confirmação */}
        <EnvelopeConfirmModal
          open={showConfirmModal}
          onOpenChange={setShowConfirmModal}
          onConfirm={handleConfirmEnvelope}
          selectedCount={selectedCount}
          expectedCash={expectedCash}
          countedCash={parseFloat(countedCash.replace(',', '.')) || 0}
          justificativa={justificativa}
          isSubmitting={isSubmitting}
        />
      </div>
    </AppLayout>
  );
}

export default function EnvelopeCashClosingPage() {
  return (
    <RequireFunction functions={['caixa', 'supervisao']}>
      <EnvelopeCashClosingContent />
    </RequireFunction>
  );
}
