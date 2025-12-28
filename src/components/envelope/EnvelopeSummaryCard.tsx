import { Card, CardContent } from '@/components/ui/card';
import { Wallet, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface EnvelopeSummaryCardProps {
  expectedCash: number;
  selectedCount: number;
  totalAvailable: number;
}

export function EnvelopeSummaryCard({
  expectedCash,
  selectedCount,
  totalAvailable,
}: EnvelopeSummaryCardProps) {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dinheiro esperado neste envelope</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(expectedCash)}
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
