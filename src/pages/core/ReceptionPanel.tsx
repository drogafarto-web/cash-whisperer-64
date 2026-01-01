import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireRole } from '@/components/auth/RequireRole';
import { KioskBreadcrumb } from '@/components/layout/KioskBreadcrumb';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertTriangle, FileUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

  // Data formatada
  const formattedDate = format(new Date(), "d MMM, EEEE", { locale: ptBR });
  const firstName = profile?.name?.split(' ')[0] || 'Usuário';
  const initials = profile?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <AppLayout>
      <div className="container py-6 max-w-lg mx-auto lg:max-w-5xl xl:max-w-6xl">
        {/* Breadcrumb */}
        {currentStep !== 'home' && (
          <div className="mb-4">
            <KioskBreadcrumb 
              homeHref="/reception-panel"
              homeLabel="Quiosque"
              items={[{ label: getStepLabel(currentStep) }]}
            />
          </div>
        )}

        {/* Header moderno - responsivo */}
        {currentStep === 'home' && (
          <div className="mb-6 lg:mb-8 lg:flex lg:items-center lg:justify-between">
            {/* Data e saudação */}
            <div className="flex justify-between items-start mb-4 lg:mb-0 lg:block">
              <span className="text-sm text-muted-foreground capitalize">
                {formattedDate}
              </span>
              {/* Avatar mobile only */}
              <div className="relative lg:hidden">
                <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                  <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              </div>
            </div>
            
            <div className="lg:flex-1 lg:ml-0">
              <p className="text-muted-foreground text-sm">Olá, {firstName}</p>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
                Quiosque
              </h1>
            </div>
            
            {/* Avatar desktop - lado direito */}
            <div className="relative hidden lg:block">
              <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                <AvatarFallback className="bg-primary text-primary-foreground font-medium text-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
            </div>
          </div>
        )}

        {/* Header para subpáginas */}
        {currentStep !== 'home' && (
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{getStepLabel(currentStep)}</h1>
          </div>
        )}

        {/* Alerta de sem itens para envelope */}
        {noItemsAlert && currentStep === 'home' && (
          <Alert variant="destructive" className="mb-6">
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
                unitId={activeUnit}
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
    <RequireRole roles={['admin', 'secretaria', 'gestor_unidade']}>
      <ReceptionPanelContent />
    </RequireRole>
  );
}
