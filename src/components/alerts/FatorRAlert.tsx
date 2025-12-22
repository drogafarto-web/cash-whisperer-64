import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp, ArrowRight, CheckCircle, DollarSign } from 'lucide-react';
import { FatorRStatus } from '@/services/taxSimulator';
import { Link } from 'react-router-dom';

interface FatorRAlertProps {
  fatorRAtual: number;
  ajusteMensal: number;
  ajusteAnual: number;
  status: FatorRStatus;
  economiaMensal?: number;
  economiaAnual?: number;
  aliquotaAnexo3?: number;
  aliquotaAnexo5?: number;
  showLink?: boolean;
  compact?: boolean;
}

export function FatorRAlert({
  fatorRAtual,
  ajusteMensal,
  ajusteAnual,
  status,
  economiaMensal = 0,
  economiaAnual = 0,
  aliquotaAnexo3 = 0,
  aliquotaAnexo5 = 0,
  showLink = true,
  compact = false,
}: FatorRAlertProps) {
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  const fatorRPercent = fatorRAtual * 100;
  const progressValue = Math.min(fatorRPercent / 35 * 100, 100);

  // ROI calculation
  const roiPercent = ajusteAnual > 0 ? ((economiaAnual - ajusteAnual) / ajusteAnual) * 100 : 0;

  if (status === 'SEGURO') {
    if (compact) return null;
    
    return (
      <Alert className="border-success/50 bg-success/10">
        <CheckCircle className="h-4 w-4 text-success" />
        <AlertTitle className="text-success">Fator R Seguro</AlertTitle>
        <AlertDescription>
          Seu Fator R está em {formatPercent(fatorRAtual)}, acima de 28%. Sua empresa está no Anexo III do Simples Nacional.
        </AlertDescription>
      </Alert>
    );
  }

  const isAbaixo = status === 'ABAIXO';
  const variant = isAbaixo ? 'destructive' : 'default';
  const bgClass = isAbaixo ? 'bg-destructive/10 border-destructive/50' : 'bg-warning/10 border-warning/50';
  const textClass = isAbaixo ? 'text-destructive' : 'text-warning';

  if (compact) {
    return (
      <Alert className={bgClass}>
        <AlertTriangle className={`h-4 w-4 ${textClass}`} />
        <AlertTitle className={textClass}>
          {isAbaixo ? 'Fator R Crítico' : 'Fator R Próximo do Limite'} ({formatPercent(fatorRAtual)})
        </AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>
            Aumente o pró-labore em <strong>{formatCurrency(ajusteMensal)}/mês</strong> para manter o Anexo III.
          </span>
          {showLink && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports/tax-scenarios">
                Ver Detalhes <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={`border-2 ${isAbaixo ? 'border-destructive' : 'border-warning'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-lg flex items-center gap-2 ${textClass}`}>
            <AlertTriangle className="h-5 w-5" />
            {isAbaixo ? 'Alerta: Fator R Crítico' : 'Atenção: Fator R Próximo do Limite'}
          </CardTitle>
          <Badge variant={isAbaixo ? 'destructive' : 'secondary'}>
            {isAbaixo ? 'Anexo V' : 'Risco de Anexo V'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fator R Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fator R Atual</span>
            <span className="font-medium">{formatPercent(fatorRAtual)} → Meta: 28%</span>
          </div>
          <Progress 
            value={progressValue} 
            className="h-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span className={fatorRPercent >= 28 ? 'text-success' : textClass}>28% (mínimo)</span>
            <span>35%</span>
          </div>
        </div>

        {/* Diagnosis */}
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-sm">
            {isAbaixo ? (
              <>
                Você está no <strong className="text-destructive">Anexo V</strong> pagando alíquota de{' '}
                <strong>{formatPercent(aliquotaAnexo5)}</strong>. Se aumentar a folha para atingir 28%, 
                cairá para <strong className="text-success">Anexo III</strong> com alíquota de{' '}
                <strong>{formatPercent(aliquotaAnexo3)}</strong>.
              </>
            ) : (
              <>
                Você está no <strong className="text-success">Anexo III</strong>, mas com margem de segurança baixa.
                Monitore a folha de pagamento para manter-se acima de 28%.
              </>
            )}
          </p>
        </div>

        {/* Adjustment Suggestion */}
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">Sugestão de Ajuste no Pró-labore</p>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Aumento mensal</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(ajusteMensal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total anual</p>
                  <p className="text-lg font-bold">{formatCurrency(ajusteAnual)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Savings */}
        {economiaMensal > 0 && (
          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-success mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm text-success">Economia Estimada</p>
                <div className="mt-2 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Por mês</p>
                    <p className="text-lg font-bold text-success">{formatCurrency(economiaMensal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Por ano</p>
                    <p className="text-lg font-bold text-success">{formatCurrency(economiaAnual)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ROI</p>
                    <p className={`text-lg font-bold ${roiPercent > 0 ? 'text-success' : 'text-destructive'}`}>
                      {roiPercent > 0 ? '+' : ''}{roiPercent.toFixed(0)}%
                    </p>
                  </div>
                </div>
                {roiPercent > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ✓ Você economiza mais do que investe no aumento do pró-labore
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Link */}
        {showLink && (
          <Button className="w-full" asChild>
            <Link to="/reports/tax-scenarios">
              Ver Cenários Tributários Completos <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
