import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LisItemForEnvelope } from '@/services/envelopeClosingService';
import { CreditCard, QrCode } from 'lucide-react';
import { PaymentMethodType } from '@/services/paymentResolutionService';

interface PaymentItemsTableProps {
  items: LisItemForEnvelope[];
  selectedIds: Set<string>;
  onToggleItem: (itemId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  allSelected: boolean;
  paymentMethod: PaymentMethodType;
}

export function PaymentItemsTable({
  items,
  selectedIds,
  onToggleItem,
  onSelectAll,
  onClearSelection,
  allSelected,
  paymentMethod,
}: PaymentItemsTableProps) {
  const handleSelectAllChange = (checked: boolean) => {
    if (checked) {
      onSelectAll();
    } else {
      onClearSelection();
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getConvenioBadge = (convenio: string | null) => {
    if (!convenio) return '-';

    if (convenio === 'PARTICULAR') {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
          Particular
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
        {convenio}
      </Badge>
    );
  };

  const showCardColumns = paymentMethod === 'CARTAO';
  const emptyMessage = paymentMethod === 'PIX'
    ? 'Nenhum código PIX pendente para confirmar'
    : 'Nenhum código de Cartão pendente para confirmar';

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAllChange}
                disabled={items.length === 0}
                aria-label="Selecionar todos"
              />
            </TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Convênio</TableHead>
            {showCardColumns ? (
              <>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
              </>
            ) : (
              <TableHead className="text-right">Valor</TableHead>
            )}
            <TableHead className="text-center w-[60px]">Pag.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showCardColumns ? 9 : 7} className="text-center text-muted-foreground py-8">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow
                key={item.id}
                className={selectedIds.has(item.id) ? 'bg-primary/5' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => onToggleItem(item.id)}
                    aria-label={`Selecionar ${item.lis_code}`}
                  />
                </TableCell>
                <TableCell className="text-sm">{formatDate(item.date)}</TableCell>
                <TableCell className="font-mono font-medium">{item.lis_code}</TableCell>
                <TableCell className="max-w-[180px] truncate text-sm">
                  {item.patient_name || '-'}
                </TableCell>
                <TableCell>{getConvenioBadge(item.convenio)}</TableCell>
                {showCardColumns ? (
                  <>
                    <TableCell className="text-right">
                      {formatCurrency(item.gross_amount || item.amount)}
                    </TableCell>
                    <TableCell className="text-right text-orange-600 dark:text-orange-400">
                      -{formatCurrency(item.card_fee_value)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.net_amount || item.amount)}
                    </TableCell>
                  </>
                ) : (
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.amount)}
                  </TableCell>
                )}
                <TableCell className="text-center">
                  {paymentMethod === 'PIX' ? (
                    <div className="flex items-center justify-center" title="PIX">
                      <QrCode className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center" title="Cartão">
                      <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
