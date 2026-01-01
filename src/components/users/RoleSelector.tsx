import { Check, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ROLE_CONFIG, AppRole } from '@/lib/access-policy';
import { cn } from '@/lib/utils';

interface RoleSelectorProps {
  value: AppRole;
  onChange: (role: AppRole) => void;
  showDescription?: boolean;
  compact?: boolean;
}

export function RoleSelector({ 
  value, 
  onChange, 
  showDescription = true,
  compact = false 
}: RoleSelectorProps) {
  return (
    <div 
      role="radiogroup" 
      aria-label="Seleção de perfil de acesso"
      className={cn(
        "grid gap-3",
        compact ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"
      )}
    >
      {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => {
        // Fallback to UserIcon if icon is missing
        const Icon = config.icon || UserIcon;
        const isSelected = value === roleKey;
        
        return (
          <button
            key={roleKey}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${config.label}: ${config.description}`}
            onClick={() => onChange(roleKey as AppRole)}
            className={cn(
              "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
              isSelected 
                ? "border-primary bg-primary/5 ring-2 ring-primary" 
                : "border-border hover:border-primary/50 hover:bg-muted/50",
              compact && "p-3"
            )}
          >
            {/* Icon */}
            <div className={cn(
              "rounded-lg flex items-center justify-center shrink-0",
              compact ? "w-8 h-8" : "w-10 h-10",
              isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <Icon className={cn(compact ? "w-4 h-4" : "w-5 h-5")} />
            </div>
            
            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "font-medium",
                  compact ? "text-sm" : "text-base"
                )}>
                  {config.label}
                </span>
                {config.requiresUnit && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Unidade
                  </Badge>
                )}
              </div>
              {showDescription && (
                <p className={cn(
                  "text-muted-foreground mt-1 line-clamp-2",
                  compact ? "text-[11px]" : "text-xs"
                )}>
                  {config.description}
                </p>
              )}
            </div>
            
            {/* Selection Indicator */}
            <div className={cn(
              "rounded-full border-2 flex items-center justify-center shrink-0",
              compact ? "w-4 h-4" : "w-5 h-5",
              isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
            )}>
              {isSelected && <Check className={cn(
                "text-primary-foreground",
                compact ? "w-2.5 h-2.5" : "w-3 h-3"
              )} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
