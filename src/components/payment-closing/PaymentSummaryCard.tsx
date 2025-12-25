import { Card, CardContent } from '@/components/ui/card';
import { QrCode, FileText } from 'lucide-react';

interface PaymentSummaryCardProps {
  totalAmount: number;
  selectedCount: number;
  totalAvailable: number;
  label?: string;
}

export function PaymentSummaryCard({
  totalAmount,
  selectedCount,
  totalAvailable,
  label = 'Total selecionado',
}: PaymentSummaryCardProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  return (
    <Card className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-800">
              <QrCode className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-sm">
              {selectedCount} de {totalAvailable} códigos selecionados
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
