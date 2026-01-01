import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useKioskMode } from '@/hooks/useKioskMode';
import { Button } from '@/components/ui/button';
import { useBadgeCounts, BadgeCounts } from '@/hooks/useBadgeCounts';
import { Menu, X, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { HelpFloatingButton } from '@/components/help/HelpFloatingButton';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isKiosk } = useKioskMode();
  const { profile, role, unit, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: badgeCounts } = useBadgeCounts();

  // Redirect to password change if required
  useEffect(() => {
    if (profile?.must_change_password && location.pathname !== '/reset-password') {
      navigate('/reset-password?force=true');
    }
  }, [profile?.must_change_password, location.pathname, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const closeMobileSidebar = () => setSidebarOpen(false);

  // Modo Quiosque: layout limpo sem sidebar
  if (isKiosk) {
    const exitKiosk = () => {
      // Remove o parâmetro mode=kiosk da URL
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      window.location.href = url.toString();
    };

    return (
      <div className="min-h-screen bg-background">
        {children}
        
        {/* Botão discreto para sair do modo quiosque */}
        <div className="fixed bottom-4 right-4 z-50">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={exitKiosk}
            className="text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <LogOut className="h-3 w-3" />
            Sair do Quiosque
          </Button>
        </div>
      </div>
    );
  }

  // Layout normal com sidebar
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
        <Sidebar
          role={role}
          profile={profile}
          unit={unit}
          badgeCounts={badgeCounts}
          onSignOut={handleSignOut}
          onCloseMobile={closeMobileSidebar}
        />
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-screen p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Floating help button */}
      <HelpFloatingButton />
    </div>
  );
}
