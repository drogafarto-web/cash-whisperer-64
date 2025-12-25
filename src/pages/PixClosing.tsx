import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireFunction } from '@/components/auth/RequireFunction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, QrCode, Check, Loader2 } from 'lucide-react';
import { PaymentItemsTable, PaymentSummaryCard } from '@/components/payment-closing';
import { usePaymentSelection } from '@/hooks/usePaymentSelection';
import { getAvailablePixItems, resolvePaymentItems, calculatePixTotal } from '@/services/paymentResolutionService';
import { logPixConfirmed } from '@/services/cashAuditService';
import { LisItemForEnvelope } from '@/services/envelopeClosingService';

type PageStep = 'loading' | 'no_items' | 'selection' | 'success';

function PixClosingContent() {
  const { user, activeUnit } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<PageStep>('loading');
  const [availableItems, setAvailableItems] = useState<LisItemForEnvelope[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);

  const {
    selectedIds,
    selectedCount,
    totalAmount,
    selectableCount,
    allSelected,
    toggleItem,
    selectAll,
    clearSelection,
    getSelectedIds,
  } = usePaymentSelection(availableItems, 'PIX');

  // Carregar dados ao montar
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!activeUnit?.id) {
      toast.error('Usuário sem unidade vinculada');
      setStep('no_items');
      return;
    }

    loadData();
  }, [user, activeUnit, navigate]);

  const loadData = async () => {
    if (!activeUnit?.id) return;

    try {
      setStep('loading');
      const items = await getAvailablePixItems(activeUnit.id);
      setAvailableItems(items);
      setStep(items.length === 0 ? 'no_items' : 'selection');
    } catch (error) {
      console.error('Erro ao carregar itens PIX:', error);
      toast.error('Erro ao carregar códigos PIX pendentes');
      setStep('no_items');
    }
  };

  const handleConfirmResolution = async () => {
    if (!activeUnit?.id || !user || selectedCount === 0) return;

    try {
      setIsSubmitting(true);
      const selectedItemIds = getSelectedIds();

      await resolvePaymentItems(selectedItemIds, activeUnit.id, 'PIX');

      // Calculate total for selected items
      const selectedItems = availableItems.filter(item => selectedIds.has(item.id));
      const amount = calculatePixTotal(selectedItems);

      // Log audit action
      await logPixConfirmed({
        userId: user.id,
        unitId: activeUnit.id,
        itemCount: selectedCount,
        amount,
        itemIds: selectedItemIds,
      });

      // Invalidar cache de badges para atualizar contagem no menu
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] });

      setConfirmedCount(selectedCount);
      toast.success(`${selectedCount} código(s) PIX confirmado(s)!`);
      setStep('success');
    } catch (error) {
      console.error('Erro ao confirmar PIX:', error);
      toast.error('Erro ao confirmar códigos PIX');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewResolution = () => {
    setConfirmedCount(0);
    clearSelection();
    loadData();
  };

  // --- Renderização condicional por step ---

  if (step === 'loading') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Carregando códigos PIX...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (step === 'no_items') {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto mt-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-teal-100 dark:bg-teal-900/30 w-fit">
                <QrCode className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              </div>
              <CardTitle>Nenhum código PIX pendente</CardTitle>
              <CardDescription>
                Todos os códigos LIS com pagamento PIX já foram confirmados.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => navigate('/cash-hub')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={() => navigate('/import/daily-movement')}>
                Importar Movimentos
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (step === 'success') {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto mt-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-green-100 dark:bg-green-900/30 w-fit">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>PIX Confirmados!</CardTitle>
              <CardDescription>
                {confirmedCount} código(s) PIX foram confirmados com sucesso.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => navigate('/cash-hub')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleNewResolution}>
                Confirmar mais PIX
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Step: selection
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cash-hub')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <QrCode className="h-6 w-6 text-teal-600" />
              Confirmar PIX
            </h1>
            <p className="text-muted-foreground">
              Selecione os códigos LIS pagos via PIX para confirmar
            </p>
          </div>
        </div>

        {/* Summary Card */}
        <PaymentSummaryCard
          totalAmount={totalAmount}
          selectedCount={selectedCount}
          totalAvailable={selectableCount}
          label="Total PIX selecionado"
        />

        {/* Table */}
        <PaymentItemsTable
          items={availableItems}
          selectedIds={selectedIds}
          onToggleItem={toggleItem}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          allSelected={allSelected}
          paymentMethod="PIX"
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/cash-hub')}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmResolution}
            disabled={selectedCount === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirmar {selectedCount} código(s)
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

export default function PixClosing() {
  return (
    <RequireFunction functions={['caixa', 'supervisao']}>
      <PixClosingContent />
    </RequireFunction>
  );
}
