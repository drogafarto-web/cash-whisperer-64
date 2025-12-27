import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calculator, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { AccountingHome, AccountingExports } from '@/components/accounting';
import { KioskBreadcrumb } from '@/components/layout/KioskBreadcrumb';

type Step = 'home' | 'exports';

function AccountingPanelContent() {
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('home');
  
  // Default: mês anterior (competência típica contábil)
  const [competence, setCompetence] = useState<Date>(() => subMonths(new Date(), 1));

  // Gerar últimos 12 meses para seleção
  const competenceOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: date,
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  });

  const currentCompetenceLabel = format(competence, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="min-h-screen bg-background">
      {/* Header fixo estilo quiosque */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Painel Contabilidade</h1>
                <p className="text-sm text-muted-foreground">
                  Olá, {profile?.name?.split(' ')[0] || 'Contador'}
                </p>
              </div>
            </div>

            {/* Seletor de competência */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 capitalize">
                  Competência: {currentCompetenceLabel}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {competenceOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.label}
                    onClick={() => setCompetence(option.value)}
                    className="capitalize"
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb quando não está na home */}
        {currentStep !== 'home' && (
          <div className="mb-6">
            <KioskBreadcrumb 
              homeHref="/accounting-panel"
              homeLabel="Contabilidade"
              items={[{ label: 'Exportações' }]}
            />
          </div>
        )}

        {currentStep === 'home' && (
          <AccountingHome 
            competence={competence}
            onGoToExports={() => setCurrentStep('exports')}
          />
        )}

        {currentStep === 'exports' && (
          <AccountingExports 
            competence={competence}
            onBack={() => setCurrentStep('home')}
          />
        )}
      </main>
    </div>
  );
}

export default function AccountingPanel() {
  const { user, isLoading, role, isAdmin } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin, contador, contabilidade e financeiro têm acesso
  const allowedRoles = ['admin', 'contador', 'contabilidade', 'financeiro'];
  const hasAccess = isAdmin || (role && allowedRoles.includes(role));

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-lg">
        <Alert variant="destructive">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Acesso Restrito</AlertTitle>
          <AlertDescription className="mt-2">
            Acesso restrito a contadores, contabilidade e financeiro.
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return <AccountingPanelContent />;
}
