import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, ChevronDown, ArrowLeft, FileBarChart, Calculator, Database, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AccountingHistory() {
  const { user, isLoading, role, isAdmin } = useAuth();
  
  // Período: últimos 14 meses até dez/2025 (antes do novo fluxo)
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => new Date(2025, 11, 1)); // Dez/2025

  // Gerar últimos 14 meses (até dez/2025)
  const monthOptions = Array.from({ length: 14 }, (_, i) => {
    const date = subMonths(new Date(2025, 11, 1), i);
    return {
      value: date,
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  });

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

  const currentMonthLabel = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });

  const historyModules = [
    {
      title: 'Cenários Tributários',
      description: 'Simulação de cenários fiscais e comparativos',
      icon: Calculator,
      href: '/reports/tax-scenarios',
      color: 'text-blue-500',
    },
    {
      title: 'Base Fiscal',
      description: 'Dados fiscais consolidados do período',
      icon: Database,
      href: '/settings/fiscal-base',
      color: 'text-purple-500',
    },
    {
      title: 'Povoação 2025',
      description: 'Seed de dados históricos e extratos',
      icon: FileBarChart,
      href: '/settings/data-2025',
      color: 'text-green-500',
    },
    {
      title: 'Auditoria Fator R',
      description: 'Análise histórica do Fator R',
      icon: ClipboardCheck,
      href: '/settings/fator-r-audit',
      color: 'text-orange-500',
    },
  ];

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/accounting-panel">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="p-2 rounded-lg bg-muted">
              <History className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Histórico Contábil</h1>
              <p className="text-sm text-muted-foreground">
                Últimos 14 meses • Prestação de contas
              </p>
            </div>
          </div>

          {/* Seletor de mês */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 capitalize">
                {currentMonthLabel}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto">
              {monthOptions.map((option) => (
                <DropdownMenuItem
                  key={option.label}
                  onClick={() => setSelectedMonth(option.value)}
                  className="capitalize"
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Info box */}
        <div className="bg-muted/50 border rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            <strong>Módulo Histórico:</strong> Este módulo contém dados do período anterior a janeiro/2026.
            Para o fluxo contínuo atual (Jan/2026+), use o{' '}
            <Link to="/accounting-panel" className="text-primary underline">
              Painel Contabilidade
            </Link>.
          </p>
        </div>

        {/* Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {historyModules.map((module) => (
            <Link key={module.href} to={module.href}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted`}>
                      <module.icon className={`h-5 w-5 ${module.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{module.title}</CardTitle>
                      <CardDescription>{module.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* Relatórios adicionais */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Relatórios do Período</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/reports/cashflow-projection">
              <Card className="hover:border-primary/50 transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <FileBarChart className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Fluxo de Caixa</span>
                </CardContent>
              </Card>
            </Link>
            <Link to="/billing/summary">
              <Card className="hover:border-primary/50 transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <FileBarChart className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Resumo Faturamento</span>
                </CardContent>
              </Card>
            </Link>
            <Link to="/reports/patrimony">
              <Card className="hover:border-primary/50 transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <FileBarChart className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Patrimônio</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
