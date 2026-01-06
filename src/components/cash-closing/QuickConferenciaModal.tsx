import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Package, Calendar, MapPin, Banknote, AlertTriangle } from 'lucide-react';

interface EnvelopeData {
  id: string;
  created_at: string;
  unit_code: string;
  unit_name: string;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  lis_codes_count: number | null;
  justificativa: string | null;
}

interface QuickConferenciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envelope: EnvelopeData | null;
  onConferir: (envelopeId: string) => void;
  isConferindo?: boolean;
}

export function QuickConferenciaModal({
  open,
  onOpenChange,
  envelope,
  onConferir,
  isConferindo = false,
}: QuickConferenciaModalProps) {
  if (!envelope) return null;

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const hasDifference = envelope.difference && envelope.difference !== 0;

  const handleConferir = () => {
    onConferir(envelope.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Conferir Envelope
          </DialogTitle>
          <DialogDescription>
            Confirme os dados do envelope antes de marcar como conferido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info básica */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDateTime(envelope.created_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{envelope.unit_name} ({envelope.unit_code})</span>
            </div>
          </div>

          {/* Valores */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Valor Esperado</span>
              <span className="font-medium">{formatCurrency(envelope.expected_cash)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Valor Contado</span>
              <span className="font-medium">{formatCurrency(envelope.counted_cash)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="text-sm font-medium">Diferença</span>
              <Badge variant={hasDifference ? 'destructive' : 'secondary'}>
                {formatCurrency(envelope.difference)}
              </Badge>
            </div>
          </div>

          {/* Atendimentos */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Banknote className="h-4 w-4" />
            <span>{envelope.lis_codes_count || 0} atendimento(s) em dinheiro</span>
          </div>

          {/* Alerta de diferença */}
          {hasDifference && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Envelope com diferença</p>
                  {envelope.justificativa ? (
                    <p className="text-muted-foreground mt-1">
                      Justificativa: "{envelope.justificativa}"
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1">
                      Nenhuma justificativa informada. Considere verificar antes de conferir.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConferir} disabled={isConferindo}>
            {isConferindo ? 'Conferindo...' : 'Confirmar Conferência'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
