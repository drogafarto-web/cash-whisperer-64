/**
 * Página de Fechamento de Caixa por Envelope
 * 
 * Conceito principal:
 * - O fechamento NÃO é por dia, mas por envelope
 * - Cada código LIS pode estar em no máximo um envelope
 * - A recepcionista cria envelopes quando quiser, selecionando códigos pagos
 * 
 * Fluxo:
 * 1. Selecionar códigos LIS disponíveis (cash_component > 0, envelope_id IS NULL)
 * 2. Sistema calcula expectedCash = soma dos selecionados
 * 3. Recepcionista digita countedCash
 * 4. Confirmar e gerar etiqueta única
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Package,
  Mail,
} from 'lucide-react';
import { useEnvelopeSelection } from '@/hooks/useEnvelopeSelection';
import {
  EnvelopeItemsTable,
  EnvelopeSummaryCard,
  EnvelopeComparisonCard,
  EnvelopeLabelPreview,
} from '@/components/envelope';
import {
  getAvailableItemsForEnvelope,
  createEnvelopeWithItems,
  checkLabelPrinted,
  markLabelPrinted,
  LisItemForEnvelope,
  EnvelopeData,
} from '@/services/envelopeClosingService';
import { generateEnvelopeZpl, downloadZplFile } from '@/utils/zpl';

type PageStep = 'loading' | 'no_closure' | 'selection' | 'comparison' | 'success';

interface LisClosureData {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  unit_id: string;
}

export default function EnvelopeCashClosingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, unit: userUnit, isLoading: authLoading } = useAuth();
  
  // Estados principais
  const [step, setStep] = useState<PageStep>('loading');
  const [lisClosure, setLisClosure] = useState<LisClosureData | null>(null);
  const [availableItems, setAvailableItems] = useState<LisItemForEnvelope[]>([]);
  const [createdEnvelope, setCreatedEnvelope] = useState<EnvelopeData | null>(null);
  
  // Estados do formulário
  const [countedCash, setCountedCash] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [labelAlreadyPrinted, setLabelAlreadyPrinted] = useState(false);
  
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const todayFormatted = useMemo(() => 
    format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }), 
  []);

  // Hook de seleção
  const {
    selectedIds,
    expectedCash,
    selectedCount,
    allSelected,
    toggleItem,
    selectAll,
    clearSelection,
    getSelectedIds,
    getSelectedItems,
  } = useEnvelopeSelection(availableItems);

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
      setStep('no_closure');
    }
  }, [user, userUnit, authLoading]);

  const loadData = async () => {
    if (!userUnit) return;
    
    setStep('loading');
    try {
      // Buscar fechamento LIS mais recente da unidade
      const { data: closures, error: closureError } = await supabase
        .from('lis_closures')
        .select('id, period_start, period_end, status, unit_id')
        .eq('unit_id', userUnit.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (closureError) throw closureError;

      if (!closures || closures.length === 0) {
        setStep('no_closure');
        return;
      }

      const closure = closures[0];
      setLisClosure(closure);

      // Buscar itens disponíveis para envelope
      const items = await getAvailableItemsForEnvelope(closure.id);
      setAvailableItems(items);

      if (items.length === 0) {
        // Sem itens disponíveis - talvez todos já em envelopes
        setStep('selection'); // Mostrar mesmo assim para informar
      } else {
        setStep('selection');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do fechamento');
      setStep('no_closure');
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

  const handleConfirmEnvelope = async () => {
    if (!user || !lisClosure || !userUnit) return;
    
    const countedValue = parseFloat(countedCash.replace(',', '.')) || 0;
    const difference = Math.abs(countedValue - expectedCash);
    
    // Se diferença > 5, exigir justificativa
    if (difference > 5 && !justificativa.trim()) {
      toast.error('Informe uma justificativa para a diferença de valores');
      return;
    }

    setIsSubmitting(true);
    try {
      const envelope = await createEnvelopeWithItems({
        closureId: lisClosure.id,
        unitId: userUnit.id,
        selectedItemIds: getSelectedIds(),
        countedCash: countedValue,
        justificativa: justificativa.trim() || undefined,
        userId: user.id,
      });

      setCreatedEnvelope(envelope);
      toast.success(`Envelope criado com ${envelope.lis_codes_count} códigos LIS!`);
      setStep('success');
    } catch (error: any) {
      console.error('Erro ao criar envelope:', error);
      toast.error(error.message || 'Erro ao criar envelope');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!createdEnvelope || !user) return;

    try {
      // Verificar se já foi impressa
      const printed = await checkLabelPrinted(createdEnvelope.id);
      setLabelAlreadyPrinted(printed);
      
      if (!printed) {
        await markLabelPrinted(createdEnvelope.id, user.id);
        toast.success('Etiqueta marcada como impressa');
      } else {
        toast.info('Etiqueta já foi impressa anteriormente (CÓPIA)');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar etiqueta');
    }
  };

  const handleDownloadZpl = () => {
    if (!createdEnvelope || !userUnit) return;

    const zplData = {
      unitName: userUnit.name || 'Unidade',
      unitCode: userUnit.code || 'UNIT',
      periodStart: format(new Date(), 'dd/MM/yyyy'),
      periodEnd: format(new Date(), 'dd/MM/yyyy'),
      cashTotal: createdEnvelope.counted_cash || createdEnvelope.expected_cash,
      lisCodes: createdEnvelope.lis_codes,
      closedByName: profile?.name || 'Usuário',
      closureId: createdEnvelope.id,
    };

    const zplContent = generateEnvelopeZpl(zplData);
    downloadZplFile(zplContent, `envelope-${createdEnvelope.id.substring(0, 8)}.zpl`);
  };

  const handleNewEnvelope = () => {
    setCreatedEnvelope(null);
    setCountedCash('');
    setJustificativa('');
    setLabelAlreadyPrinted(false);
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

  // No closure data
  if (step === 'no_closure') {
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
                  Nenhum fechamento LIS encontrado
                </h2>
                <p className="text-muted-foreground">
                  Ainda não existe movimento do LIS importado
                  {userUnit ? ` na unidade ${userUnit.name}` : ''}.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  <strong>O que fazer?</strong><br />
                  Acesse "Fechamento LIS" para importar o relatório do movimento.
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

  // Success state - mostrar envelope criado e etiqueta
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
                unitName={userUnit?.name || 'Unidade'}
                unitCode={userUnit?.code || 'UNIT'}
                countedCash={createdEnvelope.counted_cash || createdEnvelope.expected_cash}
                lisCodesCount={createdEnvelope.lis_codes_count}
                closedByName={profile?.name || 'Usuário'}
                createdAt={createdEnvelope.created_at}
                lisCodes={createdEnvelope.lis_codes}
                labelAlreadyPrinted={labelAlreadyPrinted}
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
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Fechamento de Caixa por Envelope
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
            <AlertTitle>Selecione os códigos para este envelope</AlertTitle>
            <AlertDescription>
              Marque os códigos LIS que foram pagos e vão entrar neste envelope de dinheiro.
              Cada código só pode estar em um envelope.
            </AlertDescription>
          </Alert>

          {availableItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Todos os códigos já estão em envelopes</h3>
                <p className="text-muted-foreground mb-4">
                  Não há códigos LIS disponíveis para um novo envelope neste momento.
                </p>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Voltar ao Dashboard
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Tabela de seleção */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Códigos LIS Disponíveis</CardTitle>
                  <CardDescription>
                    {availableItems.length} código(s) com valor em dinheiro disponível
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
            </>
          )}
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
            Conferência do Envelope
          </h1>
          <p className="text-muted-foreground capitalize">{todayFormatted}</p>
          {userUnit && (
            <p className="text-sm text-muted-foreground">
              Unidade: <span className="font-medium text-foreground">{userUnit.name}</span>
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
            onClick={handleConfirmEnvelope}
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
      </div>
    </AppLayout>
  );
}
