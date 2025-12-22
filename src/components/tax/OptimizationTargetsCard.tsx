import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, TrendingUp, DollarSign, ArrowRight, Lightbulb, Calculator } from 'lucide-react';
import { TaxParameters, TaxScenarioResult, calculateProlaboreAdjustment, calculateAnexoSavings, calculateAliquotaEfetivaSimples } from '@/services/taxSimulator';

interface OptimizationTarget {
  title: string;
  icon: React.ReactNode;
  items: {
    label: string;
    currentValue: string;
    targetValue?: string;
    action?: string;
    highlight?: boolean;
  }[];
}

interface OptimizationTargetsCardProps {
  fatorR: number;
  rbt12: number;
  folha12: number;
  receitaMensal: number;
  taxParameters: TaxParameters;
  cenarios: TaxScenarioResult[];
  regimeAtual: string;
}

export function OptimizationTargetsCard({
  fatorR,
  rbt12,
  folha12,
  receitaMensal,
  taxParameters,
  cenarios,
  regimeAtual,
}: OptimizationTargetsCardProps) {
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  // Calcular ajuste de pró-labore necessário
  const adjustment = calculateProlaboreAdjustment(folha12, rbt12, 0.28);
  const savings = calculateAnexoSavings(receitaMensal, rbt12, taxParameters);

  // Encontrar melhor cenário
  const melhorCenario = cenarios.reduce((a, b) => a.total < b.total ? a : b);
  const cenarioAtual = cenarios.find(c => c.regime === regimeAtual);
  const economiaRegime = cenarioAtual ? cenarioAtual.total - melhorCenario.total : 0;

  // Calcular CBS/IBS com redução de saúde
  const aliquotaCbsIbsReduzida = (taxParameters.cbs_aliquota + taxParameters.ibs_aliquota) * (1 - taxParameters.reducao_saude);
  const cenarioCbsIbs = cenarios.find(c => c.regime === 'CBS_IBS');

  const targets: OptimizationTarget[] = [];

  // 1. Alvo para Anexo III (se Fator R < 28%)
  if (fatorR < 0.28) {
    const folhaMensalAtual = folha12 / 12;
    const folhaMensalNecessaria = adjustment.folhaNecessaria / 12;

    targets.push({
      title: 'Para Manter Anexo III (Fator R ≥ 28%)',
      icon: <Target className="h-5 w-5 text-green-600" />,
      items: [
        {
          label: 'Folha mínima necessária (mensal)',
          currentValue: formatCurrency(folhaMensalAtual),
          targetValue: formatCurrency(folhaMensalNecessaria),
          highlight: true,
        },
        {
          label: 'Aumento necessário no pró-labore',
          currentValue: formatCurrency(adjustment.ajusteMensal),
          action: 'Aumentar pró-labore em ' + formatCurrency(adjustment.ajusteMensal) + '/mês',
          highlight: true,
        },
        {
          label: 'Economia com mudança de anexo',
          currentValue: formatCurrency(savings.economiaMensal) + '/mês',
          targetValue: formatCurrency(savings.economiaAnual) + '/ano',
        },
        {
          label: 'Alíquota',
          currentValue: `Anexo V: ${formatPercent(savings.aliquotaAnexo5)}`,
          targetValue: `Anexo III: ${formatPercent(savings.aliquotaAnexo3)}`,
        },
      ],
    });
  }

  // 2. Alvo para reduzir carga tributária geral
  if (economiaRegime > 0) {
    targets.push({
      title: 'Para Reduzir Carga Tributária',
      icon: <DollarSign className="h-5 w-5 text-blue-600" />,
      items: [
        {
          label: 'Melhor regime identificado',
          currentValue: melhorCenario.regimeLabel,
          highlight: true,
        },
        {
          label: 'Regime atual',
          currentValue: cenarioAtual?.regimeLabel || regimeAtual,
        },
        {
          label: 'Economia potencial',
          currentValue: formatCurrency(economiaRegime) + '/mês',
          targetValue: formatCurrency(economiaRegime * 12) + '/ano',
          highlight: true,
        },
        {
          label: 'Percentual de economia',
          currentValue: cenarioAtual ? `${((economiaRegime / cenarioAtual.total) * 100).toFixed(1)}%` : '-',
        },
      ],
    });
  }

  // 3. Informações sobre Reforma Tributária (2026+)
  if (cenarioCbsIbs) {
    const impactoReforma = cenarioAtual 
      ? ((cenarioCbsIbs.total - cenarioAtual.total) / cenarioAtual.total) * 100 
      : 0;

    targets.push({
      title: 'Reforma Tributária (2027+)',
      icon: <Calculator className="h-5 w-5 text-purple-600" />,
      items: [
        {
          label: 'Alíquota CBS/IBS com redução saúde (60%)',
          currentValue: formatPercent(aliquotaCbsIbsReduzida),
        },
        {
          label: 'Impacto estimado',
          currentValue: impactoReforma > 0 
            ? `+${impactoReforma.toFixed(1)}% (aumento)`
            : `${impactoReforma.toFixed(1)}% (redução)`,
          highlight: Math.abs(impactoReforma) > 5,
        },
        {
          label: 'Ação recomendada',
          currentValue: fatorR < 0.28 
            ? 'Regularizar Fator R antes de 2027'
            : 'Manter Fator R ≥ 28%',
          action: 'Preparar transição para novo regime',
        },
      ],
    });
  }

  // Se Fator R já está bom, mostrar status positivo
  if (fatorR >= 0.28 && targets.length === 0) {
    targets.push({
      title: 'Situação Tributária Otimizada',
      icon: <TrendingUp className="h-5 w-5 text-green-600" />,
      items: [
        {
          label: 'Fator R',
          currentValue: formatPercent(fatorR),
          targetValue: 'Acima de 28% ✓',
        },
        {
          label: 'Anexo do Simples',
          currentValue: 'Anexo III',
          targetValue: 'Alíquotas reduzidas ✓',
        },
        {
          label: 'Recomendação',
          currentValue: 'Manter folha de pagamento proporcional à receita',
        },
      ],
    });
  }

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-violet-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Alvos de Otimização Tributária</CardTitle>
            <CardDescription>
              Ações concretas para reduzir a carga tributária do seu laboratório
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {targets.map((target, idx) => (
          <div key={idx} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {target.icon}
              {target.title}
            </div>
            <div className="grid gap-2 pl-7">
              {target.items.map((item, itemIdx) => (
                <div 
                  key={itemIdx} 
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    item.highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                  }`}
                >
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={item.highlight ? 'font-bold text-foreground' : 'font-medium'}>
                      {item.currentValue}
                    </span>
                    {item.targetValue && (
                      <>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-bold text-green-600">{item.targetValue}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {target.items.find(i => i.action) && (
                <Alert className="mt-2">
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Ação:</strong> {target.items.find(i => i.action)?.action}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        ))}

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground pt-2 border-t">
          * Valores são estimativas baseadas nos dados atuais. Consulte seu contador para validar as estratégias.
        </p>
      </CardContent>
    </Card>
  );
}