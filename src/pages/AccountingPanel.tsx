import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calculator, ChevronDown, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { KioskBreadcrumb } from '@/components/layout/KioskBreadcrumb';
import { AccountingKioskHome } from '@/components/accounting/AccountingKioskHome';
import { AccountingViewData } from '@/components/accounting/AccountingViewData';
import { AccountingSendDocuments } from '@/components/accounting/AccountingSendDocuments';

type Step = 'home' | 'view-data' | 'send-documents';

interface Unit {
  id: string;
  name: string;
}

// Gerar competências a partir de Jan/2026
function getCompetenceOptions() {
  const options = [];
  const startYear = 2026;
  
  // Gerar todos os 12 meses de 2026
  for (let month = 0; month < 12; month++) {
    const date = new Date(startYear, month, 1);
    options.push({
      value: new Date(date),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
      key: `${date.getFullYear()}-${date.getMonth()}`,
    });
  }
  
  return options; // Janeiro a Dezembro
}

function AccountingPanelContent() {
  const { profile, activeUnit, userUnits } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('home');
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  
  // Competência padrão: mês atual (se >= Jan/2026) ou Jan/2026
  const [competence, setCompetence] = useState<Date>(() => {
    const now = new Date();
    if (now.getFullYear() >= 2026) {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return new Date(2026, 0, 1); // Jan/2026
  });

  const competenceOptions = getCompetenceOptions();

  // Carregar unidades
  useEffect(() => {
    async function loadUnits() {
      // Type assertion to avoid TS2589 deep instantiation error
      const client = supabase as any;
      const { data } = await client
        .from('units')
        .select('id, name')
        .order('name');
      
      if (data) {
        setUnits(data as Unit[]);
        // Se usuário tem unidade ativa, selecionar ela
        if (activeUnit?.id) {
          setSelectedUnitId(activeUnit.id);
        } else if (data.length > 0) {
          setSelectedUnitId(data[0].id);
        }
      }
    }
    loadUnits();
  }, [activeUnit]);

  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const currentCompetenceLabel = format(competence, "MMMM 'de' yyyy", { locale: ptBR });

  const stepLabels: Record<Step, string> = {
    'home': 'Início',
    'view-data': 'Dados da Contabilidade',
    'send-documents': 'Enviar Documentos',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header fixo estilo quiosque */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Painel Contabilidade</h1>
                <p className="text-sm text-muted-foreground">
                  Fluxo contínuo Jan/2026+ • {profile?.name?.split(' ')[0] || 'Usuário'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Seletor de Unidade */}
              <Select value={selectedUnitId || ''} onValueChange={setSelectedUnitId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecione unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Seletor de competência */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 capitalize">
                    {currentCompetenceLabel}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto">
                  {competenceOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.key}
                      onClick={() => setCompetence(option.value)}
                      className="capitalize"
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Link para histórico */}
              <Link to="/accounting-history">
                <Button variant="ghost" size="icon" title="Histórico (últimos 14 meses)">
                  <History className="h-5 w-5" />
                </Button>
              </Link>
            </div>
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
              items={[{ label: stepLabels[currentStep] }]}
            />
          </div>
        )}

        {currentStep === 'home' && (
          <AccountingKioskHome 
            unitId={selectedUnitId}
            unitName={selectedUnit?.name || ''}
            competence={competence}
            onViewData={() => setCurrentStep('view-data')}
            onSendDocuments={() => setCurrentStep('send-documents')}
          />
        )}

        {currentStep === 'view-data' && (
          <AccountingViewData 
            unitId={selectedUnitId}
            unitName={selectedUnit?.name || ''}
            competence={competence}
            onBack={() => setCurrentStep('home')}
          />
        )}

        {currentStep === 'send-documents' && (
          <AccountingSendDocuments 
            unitId={selectedUnitId}
            unitName={selectedUnit?.name || ''}
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
