import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export type CardStatus = 'default' | 'success' | 'warning' | 'danger';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  status?: CardStatus;
  value?: string | number;
  valuePrefix?: string;
  valueSuffix?: string;
  tooltip?: string;
  linkTo?: string;
  linkLabel?: string;
  className?: string;
  children?: ReactNode;
}

const statusStyles: Record<CardStatus, string> = {
  default: 'border-border',
  success: 'border-l-4 border-l-success',
  warning: 'border-l-4 border-l-warning',
  danger: 'border-l-4 border-l-destructive',
};

const statusValueStyles: Record<CardStatus, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

export function DashboardCard({
  title,
  subtitle,
  icon: Icon,
  status = 'default',
  value,
  valuePrefix = '',
  valueSuffix = '',
  tooltip,
  linkTo,
  linkLabel,
  className,
  children,
}: DashboardCardProps) {
  return (
    <Card className={cn(statusStyles[status], className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        {subtitle && (
          <CardDescription className="text-xs">{subtitle}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {value !== undefined && (
          <p className={cn('text-2xl font-bold', statusValueStyles[status])}>
            {valuePrefix}
            {typeof value === 'number' 
              ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
              : value}
            {valueSuffix}
          </p>
        )}
        
        {children}
        
        {linkTo && (
          <Link 
            to={linkTo}
            className="inline-flex items-center text-xs text-primary hover:underline mt-2"
          >
            {linkLabel || 'Ver detalhes'}
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
