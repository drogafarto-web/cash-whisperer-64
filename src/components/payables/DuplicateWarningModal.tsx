import { XCircle, AlertTriangle, AlertCircle, Info, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DuplicateCheckResult, DUPLICATE_LEVEL_CONFIG } from '@/types/duplicateCheck';
import { cn } from '@/lib/utils';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateCheck: DuplicateCheckResult;
  onConfirm?: () => void;
  onViewExisting?: (id: string) => void;
}

export function DuplicateWarningModal({
  isOpen,
  onClose,
  duplicateCheck,
  onConfirm,
  onViewExisting,
}: DuplicateWarningModalProps) {
  if (duplicateCheck.level === 'none') return null;

  const config = DUPLICATE_LEVEL_CONFIG[duplicateCheck.level];
  
  const getIcon = () => {
    switch (duplicateCheck.level) {
      case 'blocked':
        return <XCircle className="h-6 w-6 text-destructive" />;
      case 'high':
        return <AlertTriangle className="h-6 w-6 text-amber-500" />;
      case 'medium':
        return <AlertCircle className="h-6 w-6 text-amber-500" />;
      case 'low':
        return <Info className="h-6 w-6 text-blue-500" />;
      default:
        return null;
    }
  };

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
    const normalizedStatus = status?.toLowerCase();
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      pago: 'Pago',
      vencido: 'Vencido',
      cancelado: 'Cancelado',
    };
    return labels[normalizedStatus] || status;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
            <DialogTitle className={cn(
              duplicateCheck.level === 'blocked' && 'text-destructive',
              (duplicateCheck.level === 'high' || duplicateCheck.level === 'medium') && 'text-amber-600',
              duplicateCheck.level === 'low' && 'text-blue-600'
            )}>
              {config.title}
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        {/* Motivo da detecção */}
        {duplicateCheck.reason && (
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Motivo:</span> {duplicateCheck.reason}
            </p>
          </div>
        )}

        {/* Dados do registro existente */}
        {duplicateCheck.existingData && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Registro existente:</p>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Beneficiário:</span>{' '}
                <span className="font-medium">{duplicateCheck.existingData.beneficiario}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Valor:</span>{' '}
                <span className="font-medium">{formatCurrency(duplicateCheck.existingData.valor)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Vencimento:</span>{' '}
                <span className="font-medium">{formatDate(duplicateCheck.existingData.vencimento)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span>{' '}
                <span className={cn(
                  'font-medium',
                  (duplicateCheck.existingData.status?.toUpperCase() === 'PAGO') && 'text-emerald-600',
                  (duplicateCheck.existingData.status?.toUpperCase() === 'PENDENTE') && 'text-amber-600',
                  (duplicateCheck.existingData.status?.toUpperCase() === 'VENCIDO') && 'text-destructive'
                )}>
                  {getStatusLabel(duplicateCheck.existingData.status)}
                </span>
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Botão Ver Existente */}
          {duplicateCheck.existingId && onViewExisting && (
            <Button
              variant="outline"
              onClick={() => onViewExisting(duplicateCheck.existingId!)}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Ver registro existente
            </Button>
          )}

          {/* Botão Cancelar/Fechar */}
          <Button variant="ghost" onClick={onClose}>
            {config.allowContinue ? 'Cancelar' : 'Fechar'}
          </Button>

          {/* Botão Continuar (só se permitido) */}
          {config.allowContinue && onConfirm && (
            <Button
              variant={duplicateCheck.level === 'low' ? 'default' : 'destructive'}
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {duplicateCheck.level === 'low' ? 'Continuar' : 'Cadastrar mesmo assim'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
