import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, role, unit, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasTodayCashClosing, setHasTodayCashClosing] = useState<boolean | null>(null);

  // Verificar se existe fechamento de caixa para hoje
  useEffect(() => {
    const checkTodayCashClosing = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      let query = supabase
        .from('cash_closings')
        .select('id')
        .eq('date', today);
      
      // Se não for admin e tiver unidade, filtra pela unidade
      if (!isAdmin && unit?.id) {
        query = query.eq('unit_id', unit.id);
      }
      
      const { data, error } = await query.limit(1);
      
      if (!error) {
        setHasTodayCashClosing(data && data.length > 0);
      }
    };
    
    checkTodayCashClosing();
  }, [location.pathname, isAdmin, unit]); // Re-check when route changes or unit changes

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: true },
    { name: 'Transações', href: '/transactions', icon: Receipt, adminOnly: false },
    { name: 'Fechamento de Caixa', href: '/cash-closing', icon: DollarSign, adminOnly: false },
    { name: 'Rel. Fechamentos', href: '/reports/cash-closings', icon: FileBarChart, adminOnly: true },
    { name: 'Rel. Transações', href: '/reports/transactions', icon: FileBarChart, adminOnly: true },
    { name: 'Usuários', href: '/settings/users', icon: Users, adminOnly: true },
    { name: 'Unidades', href: '/settings/units', icon: MapPin, adminOnly: true },
    { name: 'Contas', href: '/settings/accounts', icon: Building2, adminOnly: true },
    { name: 'Categorias', href: '/settings/categories', icon: Tags, adminOnly: true },
  ];

  const filteredNav = navigation.filter(item => !item.adminOnly || isAdmin);

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
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.href;
              const showPendingBadge = item.href === '/cash-closing' && hasTodayCashClosing === false;
              
              return (
                <Link
                  key={item.name}
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
                  {showPendingBadge && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Pendente
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

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
                  <span className="capitalize">{role}</span>
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
