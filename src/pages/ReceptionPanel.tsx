import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireFunction } from '@/components/auth/RequireFunction';
import { KioskBreadcrumb } from '@/components/layout/KioskBreadcrumb';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  ReceptionHome,
  ReceptionImport,
  ReceptionDocumentUpload,
  ReceptionStep,
} from '@/components/reception';

function ReceptionPanelContent() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeUnit = profile?.unit_id || null;

  const [currentStep, setCurrentStep] = useState<ReceptionStep>('home');
  const [checkingEnvelope, setCheckingEnvelope] = useState(false);
  const [noItemsAlert, setNoItemsAlert] = useState(false);

  const handleCheckEnvelope = async () => {
    if (!activeUnit) {
      setNoItemsAlert(true);
      return;
    }

    setCheckingEnvelope(true);
    setNoItemsAlert(false);

    try {
      // Verificar se há itens de envelope disponíveis para a unidade
      const { data, error } = await supabase
        .from('lis_closure_items')
        .select('id')
        .eq('unit_id', activeUnit)
        .is('envelope_id', null)
        .gt('cash_component', 0)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        // Há itens disponíveis, redirecionar para fechamento de envelope
        navigate('/envelope-closing');
      } else {
        // Não há itens, mostrar alerta
        setNoItemsAlert(true);
      }
    } catch (error) {
      console.error('Erro ao verificar envelope:', error);
      setNoItemsAlert(true);
    } finally {
      setCheckingEnvelope(false);
    }
  };

  const handleBack = () => {
    setCurrentStep('home');
    setNoItemsAlert(false);
  };

  // Helper para pegar o nome da tela atual
  const getStepLabel = (step: ReceptionStep): string => {
    switch (step) {
      case 'import': return 'Importar Movimento';
      case 'document-upload': return 'Lançar Documentos';
      default: return '';
    }
  };

  return (
    <AppLayout>
      <div className="container py-6">
        {/* Breadcrumb */}
        {currentStep !== 'home' && (
          <div className="mb-4">
            <KioskBreadcrumb 
              homeHref="/reception-panel"
              homeLabel="Recepção"
              items={[{ label: getStepLabel(currentStep) }]}
            />
          </div>
        )}

        {/* Header simplificado */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Painel Recepção</h1>
          {profile?.name && (
            <p className="text-muted-foreground mt-1">
              Olá, {profile.name.split(' ')[0]}
            </p>
          )}
        </div>

        {/* Alerta de sem itens para envelope */}
        {noItemsAlert && currentStep === 'home' && (
          <Alert variant="destructive" className="max-w-xl mx-auto mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Não há movimento do dia importado para fechar envelope.</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-4"
                onClick={() => setCurrentStep('import')}
              >
                <FileUp className="h-4 w-4 mr-2" />
                Importar Agora
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Loader enquanto verifica envelope */}
        {checkingEnvelope && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-lg">Verificando movimento do dia...</span>
          </div>
        )}

        {/* Conteúdo baseado no step atual */}
        {!checkingEnvelope && (
          <>
            {currentStep === 'home' && (
              <ReceptionHome
                onNavigate={setCurrentStep}
                onCheckEnvelope={handleCheckEnvelope}
              />
            )}
            
            {currentStep === 'import' && (
              <ReceptionImport onBack={handleBack} unitId={activeUnit} />
            )}
            
            {currentStep === 'document-upload' && (
              <ReceptionDocumentUpload onBack={handleBack} unitId={activeUnit} />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default function ReceptionPanel() {
  return (
    <RequireFunction functions={['caixa', 'supervisao']}>
      <ReceptionPanelContent />
    </RequireFunction>
  );
}
