import { AlertTriangle, Eye, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EnvelopeWithDifference {
  id: string;
  created_at: string;
  unit_code: string;
  unit_name: string;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  justificativa: string | null;
}

interface EnvelopeDifferenceAlertProps {
  envelopes: EnvelopeWithDifference[];
  onView: (envelope: EnvelopeWithDifference) => void;
  onConferir: (envelopeId: string) => void;
  isConferindo?: boolean;
}

export function EnvelopeDifferenceAlert({
  envelopes,
  onView,
  onConferir,
  isConferindo = false,
}: EnvelopeDifferenceAlertProps) {
  if (envelopes.length === 0) return null;

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM HH:mm", { locale: ptBR });
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5 animate-pulse" />
          ATENÇÃO: Envelopes com Diferença ({envelopes.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Estes envelopes possuem diferença entre valor esperado e contado. Verifique a justificativa antes de conferir.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {envelopes.map((envelope) => (
          <div
            key={envelope.id}
            className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{formatDateTime(envelope.created_at)}</span>
                <Badge variant="outline">{envelope.unit_code}</Badge>
                <span className="text-muted-foreground">
                  Esperado: {formatCurrency(envelope.expected_cash)}
                </span>
                <span className="text-muted-foreground">
                  Contado: {formatCurrency(envelope.counted_cash)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="font-mono">
                  {formatCurrency(envelope.difference)}
                </Badge>
                {envelope.justificativa && (
                  <span className="text-sm text-muted-foreground italic">
                    "{envelope.justificativa}"
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(envelope)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Ver
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => onConferir(envelope.id)}
                disabled={isConferindo}
              >
                <Check className="h-4 w-4 mr-1" />
                Conferir
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
