import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, AlertCircle, XCircle, FileText, Clock } from 'lucide-react';
import type { TaxComparison } from '@/hooks/useAccountingAudit';
import { formatCurrencyNullable } from '@/lib/utils';

interface AuditTaxesCardProps {
  taxComparisons: TaxComparison[];
}

const statusIcons: Record<TaxComparison['status'], React.ReactNode> = {
  ok: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  warning: <AlertCircle className="h-4 w-4 text-amber-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
};

const docStatusConfig: Record<TaxComparison['documentoStatus'], { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  sem_guia: { label: 'Sem guia', icon: <FileText className="h-3 w-3" />, variant: 'outline' },
  ocr_pendente: { label: 'OCR pendente', icon: <Clock className="h-3 w-3" />, variant: 'secondary' },
  ocr_processado: { label: 'OCR OK', icon: <CheckCircle className="h-3 w-3" />, variant: 'default' },
  divergencia: { label: 'Divergência', icon: <AlertCircle className="h-3 w-3" />, variant: 'destructive' },
};

export function AuditTaxesCard({ taxComparisons }: AuditTaxesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Impostos × Guias (OCR)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Imposto</TableHead>
              <TableHead className="text-right">Informado</TableHead>
              <TableHead className="text-right">OCR</TableHead>
              <TableHead className="text-right">Dif.</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxComparisons.map((tax) => {
              const docConfig = docStatusConfig[tax.documentoStatus];
              return (
                <TableRow key={tax.imposto} className={tax.status === 'error' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                  <TableCell className="font-medium">{tax.imposto}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrencyNullable(tax.valorInformado)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrencyNullable(tax.valorOcr)}
                  </TableCell>
                  <TableCell className="text-right">
                    {tax.valorOcr !== null && (
                      <span className={`text-xs font-mono ${
                        Math.abs(tax.percentualDiferenca) > 1 ? 'text-red-600' : 'text-muted-foreground'
                      }`}>
                        {tax.percentualDiferenca >= 0 ? '+' : ''}{tax.percentualDiferenca.toFixed(1)}%
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={docConfig.variant} className="text-xs flex items-center gap-1 w-fit">
                      {docConfig.icon}
                      {docConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {statusIcons[tax.status]}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
