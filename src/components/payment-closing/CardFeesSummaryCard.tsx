import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, FileText, TrendingDown } from 'lucide-react';
import { CardTotals } from '@/services/paymentResolutionService';

interface CardFeesSummaryCardProps {
  cardTotals: CardTotals;
  selectedCount: number;
  totalAvailable: number;
}

export function CardFeesSummaryCard({
  cardTotals,
  selectedCount,
  totalAvailable,
}: CardFeesSummaryCardProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const feePercent = cardTotals.grossAmount > 0
    ? ((cardTotals.feeAmount / cardTotals.grossAmount) * 100).toFixed(1)
    : '0.0';

  return (
    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-800">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Bruto</p>
                  <p className="font-semibold text-foreground">
                    {formatCurrency(cardTotals.grossAmount)}
                  </p>
                </div>
                <div className="flex items-center text-orange-600 dark:text-orange-400">
                  <TrendingDown className="h-4 w-4 mr-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Taxa ({feePercent}%)</p>
                    <p className="font-semibold">
                      -{formatCurrency(cardTotals.feeAmount)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Líquido</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    {formatCurrency(cardTotals.netAmount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-sm">
              {selectedCount} de {totalAvailable} códigos
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
