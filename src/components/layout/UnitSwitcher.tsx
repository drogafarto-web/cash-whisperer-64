import { Check, MapPin, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * UnitSwitcher - Allows users with multiple units to switch between them
 * Only renders if user has more than 1 unit assigned
 */
export function UnitSwitcher() {
  const { userUnits, activeUnit, setActiveUnit, canAccessAllUnits } = useAuth();

  // Don't render if user has 0-1 units (unless they can access all units, in which case they use UnitSelector)
  if (userUnits.length <= 1 || canAccessAllUnits) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-8">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[120px] truncate">
            {activeUnit?.name || 'Selecionar unidade'}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {userUnits.map((profileUnit) => {
          const isSelected = activeUnit?.id === profileUnit.unit_id;
          const unitName = profileUnit.unit?.name || 'Unidade desconhecida';
          
          return (
            <DropdownMenuItem
              key={profileUnit.id}
              onClick={() => profileUnit.unit && setActiveUnit(profileUnit.unit)}
              className={cn(
                'flex items-center justify-between cursor-pointer',
                isSelected && 'bg-accent'
              )}
            >
              <span className="flex items-center gap-2">
                {unitName}
                {profileUnit.is_primary && (
                  <span className="text-xs text-muted-foreground">(principal)</span>
                )}
              </span>
              {isSelected && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
