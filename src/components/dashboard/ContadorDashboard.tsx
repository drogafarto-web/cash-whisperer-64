import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSeedProgress, TOTAL_SEED_MONTHS } from '@/hooks/useSeedData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calculator,
  FileText,
  Users,
  Receipt,
  DollarSign,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Building2,
} from 'lucide-react';

export function ContadorDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const progress = useSeedProgress();

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  const tasks = [
    {
      id: 'folha',
      title: 'Dados de Folha',
      description: `${progress.payrollMonths}/${TOTAL_SEED_MONTHS} meses preenchidos`,
      status: progress.payrollComplete ? 'done' : progress.payrollMonths > 0 ? 'partial' : 'pending',
      action: () => navigate('/settings/fiscal-base'),
      icon: Users,
    },
    {
      id: 'impostos',
      title: 'Dados de Impostos',
      description: `${progress.taxesMonths}/${TOTAL_SEED_MONTHS} meses preenchidos`,
      status: progress.taxesComplete ? 'done' : progress.taxesMonths > 0 ? 'partial' : 'pending',
      action: () => navigate('/settings/fiscal-base'),
      icon: Receipt,
    },
    {
      id: 'receitas',
      title: 'Dados de Receita',
      description: `${progress.revenueMonths}/${TOTAL_SEED_MONTHS} meses preenchidos`,
      status: progress.revenueComplete ? 'done' : progress.revenueMonths > 0 ? 'partial' : 'pending',
      action: () => navigate('/settings/fiscal-base'),
      icon: DollarSign,
    },
  ];

  const quickActions = [
    {
      title: 'Base Fiscal',
      description: 'Editar folha, impostos e receitas',
      icon: Calculator,
      href: '/settings/fiscal-base',
      primary: true,
    },
    {
      title: 'Cenários Tributários',
      description: 'Simular regimes fiscais',
      icon: TrendingUp,
      href: '/reports/tax-scenarios',
    },
    {
      title: 'Auditoria Fator R',
      description: 'Verificar cálculo do Fator R',
      icon: FileText,
      href: '/settings/fator-r-audit',
    },
    {
      title: 'Relatório Transações',
      description: 'Ver movimentações contábeis',
      icon: Receipt,
      href: '/reports/transactions',
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <Badge variant="default" className="bg-green-500">Completo</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">Em andamento</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm capitalize">{today}</p>
          <h1 className="text-2xl font-bold">
            {greeting}, {profile?.name?.split(' ')[0] || 'Contador'}!
          </h1>
          <p className="text-muted-foreground">
            Gerencie os dados fiscais e trabalhistas que alimentam os cálculos tributários.
          </p>
        </div>

        {/* Progress Overview */}
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calculator className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Base Fiscal</h3>
                  <p className="text-sm text-muted-foreground">Progresso do preenchimento</p>
                </div>
              </div>
            <div className="text-right">
                <p className="text-3xl font-bold">{Math.round(progress.totalProgress)}%</p>
                <p className="text-sm text-muted-foreground">concluído</p>
              </div>
            </div>
            <Progress value={progress.totalProgress} className="h-3" />
          </CardContent>
        </Card>

        {/* Tasks Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                task.status === 'pending' ? 'border-dashed' : ''
              }`}
              onClick={task.action}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <task.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {getStatusBadge(task.status)}
                </div>
                <h3 className="font-semibold mb-1">{task.title}</h3>
                <p className="text-sm text-muted-foreground">{task.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Button
                key={action.href}
                variant={action.primary ? 'default' : 'outline'}
                className="h-auto py-4 flex-col items-start text-left justify-start gap-2"
                onClick={() => navigate(action.href)}
              >
                <div className="flex items-center gap-2 w-full">
                  <action.icon className="h-5 w-5" />
                  <span className="font-medium">{action.title}</span>
                </div>
                <span className="text-xs opacity-70 font-normal">{action.description}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Seu papel no sistema</h3>
                <p className="text-sm text-muted-foreground">
                  Como contador/consultor, você tem acesso aos dados fiscais e trabalhistas para manter 
                  a base de cálculo do Fator R atualizada. Suas alterações alimentam os cenários tributários 
                  e relatórios de auditoria.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
