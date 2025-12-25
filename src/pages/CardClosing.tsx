import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, CreditCard, Check, Loader2 } from 'lucide-react';
import { PaymentItemsTable, CardFeesSummaryCard } from '@/components/payment-closing';
import { usePaymentSelection } from '@/hooks/usePaymentSelection';
import { getAvailableCardItems, resolvePaymentItems, CardTotals } from '@/services/paymentResolutionService';
import { LisItemForEnvelope } from '@/services/envelopeClosingService';

type PageStep = 'loading' | 'no_items' | 'selection' | 'success';

export default function CardClosing() {
  const { user, unit } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<PageStep>('loading');
  const [availableItems, setAvailableItems] = useState<LisItemForEnvelope[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);

  const {
    selectedIds,
    selectedCount,
    cardTotals,
    selectableCount,
    allSelected,
    toggleItem,
    selectAll,
    clearSelection,
    getSelectedIds,
  } = usePaymentSelection(availableItems, 'CARTAO');

  // Carregar dados ao montar
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!unit?.id) {
      toast.error('Usuário sem unidade vinculada');
      setStep('no_items');
      return;
    }

    loadData();
  }, [user, unit, navigate]);

  const loadData = async () => {
    if (!unit?.id) return;

    try {
      setStep('loading');
      const items = await getAvailableCardItems(unit.id);
      setAvailableItems(items);
      setStep(items.length === 0 ? 'no_items' : 'selection');
    } catch (error) {
      console.error('Erro ao carregar itens Cartão:', error);
      toast.error('Erro ao carregar códigos de Cartão pendentes');
      setStep('no_items');
    }
  };

  const handleConfirmResolution = async () => {
    if (!unit?.id || selectedCount === 0) return;

    try {
      setIsSubmitting(true);
      const selectedItemIds = getSelectedIds();

      await resolvePaymentItems(selectedItemIds, unit.id, 'CARTAO');

      setConfirmedCount(selectedCount);
      toast.success(`${selectedCount} código(s) de Cartão confirmado(s)!`);
      setStep('success');
    } catch (error) {
      console.error('Erro ao confirmar Cartão:', error);
      toast.error('Erro ao confirmar códigos de Cartão');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewResolution = () => {
    setConfirmedCount(0);
    clearSelection();
    loadData();
  };

  // Default card totals for when none selected
  const displayCardTotals: CardTotals = cardTotals || {
    grossAmount: 0,
    feeAmount: 0,
    netAmount: 0,
  };

  // --- Renderização condicional por step ---

  if (step === 'loading') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Carregando códigos de Cartão...</p>
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
              <div className="mx-auto mb-4 p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 w-fit">
                <CreditCard className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Nenhum código de Cartão pendente</CardTitle>
              <CardDescription>
                Todos os códigos LIS com pagamento em Cartão já foram confirmados.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => navigate('/envelope-closing')}>
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
              <CardTitle>Cartões Confirmados!</CardTitle>
              <CardDescription>
                {confirmedCount} código(s) de Cartão foram confirmados com sucesso.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => navigate('/envelope-closing')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleNewResolution}>
                Confirmar mais Cartões
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/envelope-closing')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-blue-600" />
              Confirmar Cartão
            </h1>
            <p className="text-muted-foreground">
              Selecione os códigos LIS pagos via Cartão para confirmar
            </p>
          </div>
        </div>

        {/* Summary Card with fees */}
        <CardFeesSummaryCard
          cardTotals={displayCardTotals}
          selectedCount={selectedCount}
          totalAvailable={selectableCount}
        />

        {/* Table */}
        <PaymentItemsTable
          items={availableItems}
          selectedIds={selectedIds}
          onToggleItem={toggleItem}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          allSelected={allSelected}
          paymentMethod="CARTAO"
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/envelope-closing')}
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
