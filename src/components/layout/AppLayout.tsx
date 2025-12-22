import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBadgeCounts } from '@/hooks/useBadgeCounts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  Receipt,
  DollarSign,
  LogOut,
  Menu,
  X,
  Users,
  Building2,
  Tags,
  AlertCircle,
  MapPin,
  FileBarChart,
  FileUp,
  Handshake,
  Calculator,
  Settings,
  Bell,
  ChevronDown,
  FileText,
  Wallet,
  TrendingUp,
  ShieldAlert,
  Cog,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppRole } from '@/types/database';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Tooltips explicativos para cada badge
const BADGE_TOOLTIPS: Record<string, string> = {
  caixaUnidades: 'unidade(s) sem fechamento de caixa hoje',
  lucratividade: 'categoria(s) sem grupo tributário definido',
  riscoEstrategia: 'alerta(s) de risco ativo(s)',
  tributacao: 'unidade(s) sem configuração tributária',
};

interface AppLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: AppRole[];
}

interface NavGroup {
  id: string;
  name: string;
  icon: React.ElementType;
  items: NavItem[];
  badgeKey?: 'caixaUnidades' | 'lucratividade' | 'riscoEstrategia' | 'tributacao';
}

// Navegação organizada por objetivos estratégicos
const navigationGroups: NavGroup[] = [
  {
    id: 'overview',
    name: 'Visão Geral',
    icon: LayoutDashboard,
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'secretaria', 'gestor_unidade'] },
    ],
  },
  {
    id: 'prestacao-contas',
    name: 'Prestação de Contas',
    icon: FileText,
    items: [
      { name: 'Rel. Fechamentos', href: '/reports/cash-closings', icon: FileBarChart, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
      { name: 'Rel. Transações', href: '/reports/transactions', icon: FileBarChart, roles: ['admin', 'contabilidade', 'gestor_unidade'] },
    ],
  },
  {
    id: 'caixa-unidades',
    name: 'Caixa & Unidades',
    icon: Wallet,
    badgeKey: 'caixaUnidades',
    items: [
      { name: 'Fechamento de Caixa', href: '/cash-closing', icon: DollarSign, roles: ['admin', 'secretaria', 'gestor_unidade'] },
      { name: 'Transações', href: '/transactions', icon: Receipt, roles: ['admin', 'secretaria', 'contabilidade', 'gestor_unidade'] },
      { name: 'Importar LIS', href: '/import/daily-movement', icon: FileUp, roles: ['admin', 'secretaria', 'gestor_unidade'] },
      { name: 'Importar Extrato', href: '/import/bank-statement', icon: FileUp, roles: ['admin', 'secretaria', 'gestor_unidade'] },
      { name: 'Unidades', href: '/settings/units', icon: MapPin, roles: ['admin'] },
      { name: 'Contas', href: '/settings/accounts', icon: Building2, roles: ['admin'] },
    ],
  },
  {
    id: 'tributacao-cenarios',
    name: 'Tributação & Cenários',
    icon: Calculator,
    badgeKey: 'tributacao',
    items: [
      { name: 'Cenários Tributários', href: '/reports/tax-scenarios', icon: Calculator, roles: ['admin', 'contabilidade'] },
      { name: 'Config. Tributária', href: '/settings/tax-config', icon: Settings, roles: ['admin'] },
    ],
  },
  {
    id: 'lucratividade',
    name: 'Lucratividade & Custos',
    icon: TrendingUp,
    badgeKey: 'lucratividade',
    items: [
      { name: 'Categorias', href: '/settings/categories', icon: Tags, roles: ['admin'] },
      { name: 'Parceiros', href: '/settings/partners', icon: Handshake, roles: ['admin'] },
    ],
  },
  {
    id: 'risco-estrategia',
    name: 'Risco & Estratégia',
    icon: ShieldAlert,
    badgeKey: 'riscoEstrategia',
    items: [
      { name: 'Povoação 2025', href: '/settings/data-2025', icon: Database, roles: ['admin', 'contabilidade'] },
      { name: 'Real x Oficial', href: '/reports/personnel-real-vs-official', icon: Users, roles: ['admin'] },
      { name: 'Auditoria Fator R', href: '/settings/fator-r-audit', icon: Calculator, roles: ['admin', 'contabilidade'] },
      { name: 'Alertas', href: '/settings/alerts', icon: Bell, roles: ['admin'] },
      { name: 'Usuários', href: '/settings/users', icon: Users, roles: ['admin'] },
    ],
  },
];

// Labels amigáveis para os papéis
const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  contabilidade: 'Contabilidade',
  gestor_unidade: 'Gestor',
  secretaria: 'Atendente',
};

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, role, unit, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const { data: badgeCounts } = useBadgeCounts();

  // Inicializa grupos abertos baseado na rota atual
  useEffect(() => {
    const currentPath = location.pathname;
    const initialOpen: Record<string, boolean> = {};
    
    navigationGroups.forEach(group => {
      const hasActiveItem = group.items.some(item => currentPath === item.href);
      if (hasActiveItem) {
        initialOpen[group.id] = true;
      }
    });
    
    setOpenGroups(prev => ({ ...prev, ...initialOpen }));
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Filtra grupos e itens baseado no papel do usuário
  const filteredGroups = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => role && item.roles.includes(role)),
    }))
    .filter(group => group.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
            <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Labclin</h1>
              <p className="text-xs text-sidebar-foreground/70">Gestão Financeira</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
            {filteredGroups.map((group) => {
              const isGroupOpen = openGroups[group.id] ?? false;
              const hasActiveItem = group.items.some(item => location.pathname === item.href);
              const GroupIcon = group.icon;
              const groupBadgeCount = group.badgeKey && badgeCounts ? badgeCounts[group.badgeKey] : 0;

              // Se o grupo tem apenas 1 item, renderiza diretamente sem collapsible
              if (group.items.length === 1) {
                const item = group.items[0];
                const isActive = location.pathname === item.href;

                return (
                  <Link
                    key={group.id}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="flex-1">{item.name}</span>
                  </Link>
                );
              }

              return (
                <Collapsible
                  key={group.id}
                  open={isGroupOpen || hasActiveItem}
                  onOpenChange={() => toggleGroup(group.id)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        hasActiveItem
                          ? "text-sidebar-foreground"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <GroupIcon className="w-5 h-5" />
                      <span className="flex-1 text-left">{group.name}</span>
                      {groupBadgeCount > 0 && group.badgeKey && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant={group.badgeKey === 'caixaUnidades' || group.badgeKey === 'riscoEstrategia' ? 'destructive' : 'secondary'} 
                                className="text-xs px-1.5 py-0.5 mr-1 cursor-help"
                              >
                                {groupBadgeCount}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p>{groupBadgeCount} {BADGE_TOOLTIPS[group.badgeKey]}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-200",
                          (isGroupOpen || hasActiveItem) && "rotate-180"
                        )}
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 mt-1 space-y-1">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;

                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                          )}
                        >
                          <item.icon className="w-4 h-4" />
                          <span className="flex-1">{item.name}</span>
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </nav>

          {/* Settings Hub Link */}
          <div className="px-3 pb-2">
            <Link
              to="/settings"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === '/settings'
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Cog className="w-5 h-5" />
              <span className="flex-1">Configurações</span>
            </Link>
          </div>

          {/* User info */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-sm font-medium">
                  {profile?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.name}</p>
                <div className="flex items-center gap-1 text-xs text-sidebar-foreground/70">
                  <span>{role ? ROLE_LABELS[role] : 'Sem papel'}</span>
                  {unit && (
                    <>
                      <span>•</span>
                      <span className="truncate">{unit.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-screen p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
