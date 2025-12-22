import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useBadgeCounts } from '@/hooks/useBadgeCounts';
import { useAuth } from '@/hooks/useAuth';
import {
  FileText,
  Wallet,
  Calculator,
  TrendingUp,
  ShieldAlert,
  FileBarChart,
  DollarSign,
  Receipt,
  FileUp,
  MapPin,
  Building2,
  Settings,
  Tags,
  Handshake,
  Users,
  Bell,
  ChevronRight,
  Database,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSeedProgress } from '@/hooks/useSeedData';
import { Progress } from '@/components/ui/progress';

interface SettingsCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  links: Array<{
    name: string;
    href: string;
    icon: React.ElementType;
  }>;
  badgeKey?: keyof ReturnType<typeof useBadgeCounts>['data'];
  badgeVariant?: 'destructive' | 'secondary' | 'outline';
}

const settingsCards: SettingsCard[] = [
  {
    id: 'prestacao-contas',
    title: 'Prestação de Contas',
    description: 'Relatórios e exportações para o espólio e stakeholders',
    icon: FileText,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    links: [
      { name: 'Relatório de Fechamentos', href: '/reports/cash-closings', icon: FileBarChart },
      { name: 'Relatório de Transações', href: '/reports/transactions', icon: FileBarChart },
    ],
  },
  {
    id: 'caixa-unidades',
    title: 'Caixa & Unidades',
    description: 'Controle de caixa diário e gestão de unidades',
    icon: Wallet,
    iconColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    badgeKey: 'caixaUnidades',
    badgeVariant: 'destructive',
    links: [
      { name: 'Fechamento de Caixa', href: '/cash-closing', icon: DollarSign },
      { name: 'Transações', href: '/transactions', icon: Receipt },
      { name: 'Importar LIS', href: '/import/daily-movement', icon: FileUp },
      { name: 'Importar Extrato', href: '/import/bank-statement', icon: FileUp },
      { name: 'Unidades', href: '/settings/units', icon: MapPin },
      { name: 'Contas', href: '/settings/accounts', icon: Building2 },
    ],
  },
  {
    id: 'tributacao-cenarios',
    title: 'Tributação & Cenários',
    description: 'Configurações tributárias e simulação de regimes',
    icon: Calculator,
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    badgeKey: 'tributacao',
    badgeVariant: 'secondary',
    links: [
      { name: 'Cenários Tributários', href: '/reports/tax-scenarios', icon: Calculator },
      { name: 'Configuração Tributária', href: '/settings/tax-config', icon: Settings },
    ],
  },
  {
    id: 'lucratividade',
    title: 'Lucratividade & Custos',
    description: 'Categorização e parceiros para análise de margem',
    icon: TrendingUp,
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    badgeKey: 'lucratividade',
    badgeVariant: 'secondary',
    links: [
      { name: 'Categorias', href: '/settings/categories', icon: Tags },
      { name: 'Parceiros', href: '/settings/partners', icon: Handshake },
    ],
  },
  {
    id: 'risco-estrategia',
    title: 'Risco & Estratégia',
    description: 'Alertas, auditoria e gestão de riscos fiscais',
    icon: ShieldAlert,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    badgeKey: 'riscoEstrategia',
    badgeVariant: 'destructive',
    links: [
      { name: 'Dados Históricos', href: '/settings/data-2025', icon: Database },
      { name: 'Real x Oficial', href: '/reports/personnel-real-vs-official', icon: Users },
      { name: 'Auditoria Fator R', href: '/settings/fator-r-audit', icon: Calculator },
      { name: 'Alertas', href: '/settings/alerts', icon: Bell },
      { name: 'Usuários', href: '/settings/users', icon: Users },
    ],
  },
];

export default function SettingsHub() {
  const { data: badgeCounts, isLoading } = useBadgeCounts();
  const { role, isAdmin, isContabilidade } = useAuth();
  const seedProgress = useSeedProgress();

  // Filtrar links baseado no role do usuário
  const getFilteredLinks = (card: SettingsCard) => {
    const roleAccess: Record<string, string[]> = {
      admin: ['*'],
      contabilidade: [
        '/reports/cash-closings',
        '/reports/transactions',
        '/reports/tax-scenarios',
        '/settings/fator-r-audit',
        '/settings/data-2025',
      ],
      gestor_unidade: [
        '/cash-closing',
        '/transactions',
        '/import/daily-movement',
        '/import/bank-statement',
        '/reports/cash-closings',
        '/reports/transactions',
      ],
      secretaria: [
        '/cash-closing',
        '/transactions',
        '/import/daily-movement',
        '/import/bank-statement',
      ],
    };

    if (!role) return [];

    const allowedPaths = roleAccess[role];
    if (allowedPaths.includes('*')) return card.links;

    return card.links.filter((link) => allowedPaths.includes(link.href));
  };

  const visibleCards = settingsCards
    .map((card) => ({
      ...card,
      links: getFilteredLinks(card),
    }))
    .filter((card) => card.links.length > 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações do sistema organizadas por objetivos estratégicos
          </p>
        </div>

        {/* Card de destaque para Dados Históricos */}
        {(isAdmin || isContabilidade) && seedProgress.totalProgress < 100 && (
          <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-violet-500/5">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      Dados para Prestação de Contas
                      <Badge variant="outline" className="text-xs">Nov/2024 - Dez/2025</Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Registre dados históricos do período de prestação de contas ({seedProgress.totalMonths} meses)
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={seedProgress.totalProgress} className="h-2 flex-1 max-w-[200px]" />
                      <span className="text-xs text-muted-foreground">{seedProgress.totalProgress}% completo</span>
                    </div>
                  </div>
                </div>
                <Link to="/settings/data-2025">
                  <Button className="gap-2">
                    <Database className="h-4 w-4" />
                    Preencher Dados
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => {
            const IconComponent = card.icon;
            const badgeCount = card.badgeKey && badgeCounts ? badgeCounts[card.badgeKey] : 0;

            return (
              <Card
                key={card.id}
                className="relative overflow-hidden hover:shadow-lg transition-shadow duration-200"
              >
                <CardHeader className={cn('pb-3', card.bgColor)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg bg-background/80')}>
                        <IconComponent className={cn('w-6 h-6', card.iconColor)} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{card.title}</CardTitle>
                      </div>
                    </div>
                    {badgeCount > 0 && !isLoading && (
                      <Badge variant={card.badgeVariant || 'secondary'} className="text-xs">
                        {badgeCount}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm mt-2">{card.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-1">
                    {card.links.map((link) => {
                      const LinkIcon = link.icon;
                      return (
                        <Link
                          key={link.href}
                          to={link.href}
                          className="flex items-center justify-between p-2 -mx-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <LinkIcon className="w-4 h-4" />
                            <span>{link.name}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
