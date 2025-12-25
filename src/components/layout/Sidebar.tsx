import { Link } from 'react-router-dom';
import { LogOut, ChevronDown, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { NavGroup, BADGE_TOOLTIPS, ROLE_LABELS } from './navigation.config';
import { useSidebarNavigation } from './useSidebarNavigation';
import { BadgeCounts } from '@/hooks/useBadgeCounts';
import { AppRole } from '@/types/database';
import labclinLogo from '@/assets/labclin-logo.png';

interface SidebarProps {
  role: AppRole | null;
  profile: { name?: string } | null;
  unit: { name: string } | null;
  badgeCounts: BadgeCounts | undefined;
  onSignOut: () => void;
  onCloseMobile: () => void;
}

export function Sidebar({
  role,
  profile,
  unit,
  badgeCounts,
  onSignOut,
  onCloseMobile,
}: SidebarProps) {
  const {
    filteredGroups,
    toggleGroup,
    isActiveRoute,
    isGroupActive,
    isGroupOpen,
    currentPath,
  } = useSidebarNavigation(role);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <img 
          src={labclinLogo} 
          alt="LabClin Logo" 
          className="h-10 w-auto object-contain"
        />
        <div>
          <h1 className="font-semibold text-lg">Labclin</h1>
          <p className="text-xs text-sidebar-foreground/70">Gestão Financeira</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {filteredGroups.map((group) => (
          <NavGroupItem
            key={group.id}
            group={group}
            isOpen={isGroupOpen(group.id) || isGroupActive(group)}
            isActive={isGroupActive(group)}
            badgeCount={group.badgeKey && badgeCounts ? badgeCounts[group.badgeKey] : 0}
            badgeCounts={badgeCounts}
            onToggle={() => toggleGroup(group.id)}
            onItemClick={onCloseMobile}
            isActiveRoute={isActiveRoute}
          />
        ))}
      </nav>

      {/* Settings Hub Link */}
      <div className="px-3 pb-2">
        <Link
          to="/settings"
          onClick={onCloseMobile}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            currentPath === '/settings'
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
          onClick={onSignOut}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
}

// Subcomponente para cada grupo de navegação
interface NavGroupItemProps {
  group: NavGroup;
  isOpen: boolean;
  isActive: boolean;
  badgeCount: number;
  badgeCounts?: BadgeCounts;
  onToggle: () => void;
  onItemClick: () => void;
  isActiveRoute: (href: string) => boolean;
}

function NavGroupItem({
  group,
  isOpen,
  isActive,
  badgeCount,
  badgeCounts,
  onToggle,
  onItemClick,
  isActiveRoute,
}: NavGroupItemProps) {
  const GroupIcon = group.icon;

  // Se o grupo tem apenas 1 item, renderiza diretamente sem collapsible
  if (group.items.length === 1) {
    const item = group.items[0];
    const active = isActiveRoute(item.href);

    return (
      <Link
        to={item.href}
        onClick={onItemClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          active
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
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            isActive
              ? "text-sidebar-foreground"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <GroupIcon className="w-5 h-5" />
          <span className="flex-1 text-left">{group.name}</span>
          {badgeCount > 0 && group.badgeKey && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant={group.badgeKey === 'caixaUnidades' || group.badgeKey === 'riscoEstrategia' ? 'destructive' : 'secondary'} 
                    className="text-xs px-1.5 py-0.5 mr-1 cursor-help"
                  >
                    {badgeCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p>{badgeCount} {BADGE_TOOLTIPS[group.badgeKey]}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 mt-1 space-y-1">
        {group.items.map((item) => {
          const active = isActiveRoute(item.href);
          const itemBadgeCount = item.badgeKey && badgeCounts ? badgeCounts[item.badgeKey] : 0;

          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1">{item.name}</span>
              {itemBadgeCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="secondary" 
                        className="text-xs px-1.5 py-0 min-w-[1.25rem] h-5 flex items-center justify-center"
                      >
                        {itemBadgeCount}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{itemBadgeCount} {BADGE_TOOLTIPS[item.badgeKey!]}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
