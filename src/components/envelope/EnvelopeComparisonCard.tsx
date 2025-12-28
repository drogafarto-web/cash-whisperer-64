import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface EnvelopeComparisonCardProps {
  expectedCash: number;
  countedCash: string;
  onCountedCashChange: (value: string) => void;
  justificativa: string;
  onJustificativaChange: (value: string) => void;
  selectedCount: number;
}

export function EnvelopeComparisonCard({
  expectedCash,
  countedCash,
  onCountedCashChange,
  justificativa,
  onJustificativaChange,
  selectedCount,
}: EnvelopeComparisonCardProps) {
  const countedValue = parseFloat(countedCash.replace(',', '.')) || 0;
  const difference = countedValue - expectedCash;
  const absDifference = Math.abs(difference);

  // Determinar status da comparação
  const getStatus = () => {
    if (!countedCash) return 'pending';
    if (absDifference < 0.01) return 'match';
    if (absDifference <= 5) return 'warning';
    return 'error';
  };

  const status = getStatus();

  const statusConfig = {
    pending: { 
      icon: AlertCircle, 
      color: 'text-muted-foreground', 
      bgColor: 'bg-muted',
      label: 'Aguardando contagem'
    },
    match: { 
      icon: CheckCircle2, 
      color: 'text-green-600 dark:text-green-400', 
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      label: 'Valores conferem'
    },
    warning: { 
      icon: AlertCircle, 
      color: 'text-yellow-600 dark:text-yellow-400', 
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      label: 'Pequena diferença'
    },
    error: { 
      icon: XCircle, 
      color: 'text-red-600 dark:text-red-400', 
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      label: 'Diferença significativa'
    },
  };

  const { icon: StatusIcon, color, bgColor, label } = statusConfig[status];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Conferência do Envelope</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Códigos selecionados</p>
            <p className="text-lg font-semibold">{selectedCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Valor esperado</p>
            <p className="text-lg font-semibold text-primary">{formatCurrency(expectedCash)}</p>
          </div>
        </div>

        {/* Input de contagem */}
        <div className="space-y-2">
          <Label htmlFor="countedCash">Quanto você contou no caixa?</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              R$
            </span>
            <Input
              id="countedCash"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={countedCash}
              onChange={(e) => onCountedCashChange(e.target.value)}
              className="pl-10 text-lg"
            />
          </div>
        </div>

        {/* Comparação */}
        {countedCash && (
          <div className={`p-4 rounded-lg ${bgColor}`}>
            <div className="flex items-center gap-2 mb-3">
              <StatusIcon className={`h-5 w-5 ${color}`} />
              <span className={`font-medium ${color}`}>{label}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Esperado</p>
                <p className="font-semibold">{formatCurrency(expectedCash)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contado</p>
                <p className="font-semibold">{formatCurrency(countedValue)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Diferença</p>
                <p className={`font-semibold ${
                  difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : ''
                }`}>
                  {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Justificativa (aparece se houver diferença) */}
        {status === 'warning' || status === 'error' ? (
          <div className="space-y-2">
            <Label htmlFor="justificativa">
              Justificativa {status === 'error' && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="justificativa"
              placeholder="Explique a diferença encontrada..."
              value={justificativa}
              onChange={(e) => onJustificativaChange(e.target.value)}
              rows={3}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
