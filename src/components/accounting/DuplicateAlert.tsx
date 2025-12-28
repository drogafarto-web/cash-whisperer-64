import { XCircle, AlertTriangle, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DuplicateCheckResult, DUPLICATE_LEVEL_CONFIG } from '@/types/duplicateCheck';
import { cn } from '@/lib/utils';

interface DuplicateAlertProps {
  duplicateCheck: DuplicateCheckResult;
  onViewExisting?: (id: string) => void;
  onConfirmContinue?: () => void;
  className?: string;
}

export function DuplicateAlert({
  duplicateCheck,
  onViewExisting,
  onConfirmContinue,
  className,
}: DuplicateAlertProps) {
  if (duplicateCheck.level === 'none') return null;

  const config = DUPLICATE_LEVEL_CONFIG[duplicateCheck.level];

  const getIcon = () => {
    switch (duplicateCheck.level) {
      case 'blocked':
        return XCircle;
      case 'high':
        return AlertTriangle;
      case 'medium':
        return AlertCircle;
      case 'low':
        return Info;
      default:
        return Info;
    }
  };

  const Icon = getIcon();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    try {
      return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
    } catch {
      return date;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      pago: 'Pago',
      vencido: 'Vencido',
      cancelado: 'Cancelado',
    };
    return labels[status] || status;
  };

  const alertVariant = duplicateCheck.level === 'blocked' ? 'destructive' : 'default';

  return (
    <Alert
      variant={alertVariant}
      className={cn(
        duplicateCheck.level === 'high' && 'border-amber-500 bg-amber-500/10',
        duplicateCheck.level === 'medium' && 'border-amber-400 bg-amber-400/10',
        duplicateCheck.level === 'low' && 'border-blue-400 bg-blue-400/10',
        className
      )}
    >
      <Icon className={cn(
        'h-4 w-4',
        duplicateCheck.level === 'blocked' && 'text-destructive',
        duplicateCheck.level === 'high' && 'text-amber-500',
        duplicateCheck.level === 'medium' && 'text-amber-400',
        duplicateCheck.level === 'low' && 'text-blue-500'
      )} />
      <AlertTitle className={cn(
        duplicateCheck.level === 'blocked' && 'text-destructive',
        duplicateCheck.level === 'high' && 'text-amber-600',
        duplicateCheck.level === 'medium' && 'text-amber-500',
        duplicateCheck.level === 'low' && 'text-blue-600'
      )}>
        {config.title}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        {/* Motivo */}
        <p className="text-sm">{duplicateCheck.reason}</p>

        {/* Dados do registro existente */}
        {duplicateCheck.existingData && (
          <div className="p-2 bg-background/50 rounded border text-sm space-y-1">
            <p className="font-medium">Registro existente:</p>
            <p>
              {duplicateCheck.existingData.beneficiario} –{' '}
              {formatCurrency(duplicateCheck.existingData.valor)} –{' '}
              Venc: {formatDate(duplicateCheck.existingData.vencimento)} –{' '}
              <span className={cn(
                'font-medium',
                duplicateCheck.existingData.status === 'pago' && 'text-emerald-600',
                duplicateCheck.existingData.status === 'pendente' && 'text-amber-600',
                duplicateCheck.existingData.status === 'vencido' && 'text-destructive'
              )}>
                {getStatusLabel(duplicateCheck.existingData.status)}
              </span>
            </p>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex flex-wrap gap-2 pt-1">
          {duplicateCheck.existingId && onViewExisting && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewExisting(duplicateCheck.existingId!)}
              className="gap-1 text-xs"
            >
              <ExternalLink className="h-3 w-3" />
              Ver registro existente
            </Button>
          )}

          {config.allowContinue && onConfirmContinue && (
            <Button
              variant={duplicateCheck.level === 'low' ? 'secondary' : 'destructive'}
              size="sm"
              onClick={onConfirmContinue}
              className="text-xs"
            >
              {duplicateCheck.level === 'low' ? 'Continuar mesmo assim' : 'Cadastrar mesmo assim'}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
